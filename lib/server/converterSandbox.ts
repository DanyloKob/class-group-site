// NO "server-only" import: conversionQueue.ts (imported by instrumentation.ts) uses this module.
// Self-contained on purpose (node: built-ins only, erasable TypeScript) so the security tests can
// import it straight into node and exercise exactly the wrapper production uses.
import { spawn, type StdioOptions } from "node:child_process";
import { randomBytes } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Runs LibreOffice on untrusted input (layers 2 and 3; pptxSafety.ts is layer 1).
 *
 * Layer 2, the sandbox (CONVERTER_SANDBOX=bwrap, the default): bubblewrap with every namespace
 * unshared (so no network at all: only a loopback nobody listens on), --die-with-parent and
 * --new-session, read-only /usr plus the few /etc files LibreOffice needs, a private tmpfs /tmp,
 * and ONE writable bind: the job's own directory, mounted at /job, holding a copy of the input,
 * the output dir and a fresh LibreOffice profile. The app directory, its .env, home directories,
 * /etc/passwd and other materials do not exist inside. If bwrap is missing or fails its one-time
 * self-test, conversions FAIL; they never fall back to running unsandboxed.
 *
 * Layer 3, the environment: the child gets PATH, HOME, LANG, LC_ALL and TMPDIR and nothing else
 * (no DATABASE_URL, no TELEGRAM_*), both through spawn's env and bwrap's --clearenv.
 *
 * CONVERTER_SANDBOX=off runs soffice directly (still with the minimal env). It is for development
 * only, logs a loud warning on every conversion and is refused when NODE_ENV=production.
 */

export type ConvertResult = { ok: true } | { ok: false; error: string };

/** The job dir as the sandboxed process sees it. */
const JOB = "/job";
const CHILD_PATH = "/usr/bin:/bin";
const CHILD_LOCALE = "C.UTF-8";
const MAX_OUTPUT_BYTES = 256 * 1024 * 1024;
const SELF_TEST_TIMEOUT_MS = 20_000;
/** Read-only binds besides /usr, if they exist on the host. /etc/libreoffice holds Debian/Ubuntu's sofficerc and registry. */
const OPTIONAL_RO_BINDS = ["/etc/fonts", "/etc/ld.so.cache", "/etc/libreoffice", "/var/cache/fontconfig"];
/** Merged-/usr symlinks (or real dirs on older systems). */
const ROOT_LINKS = ["/bin", "/sbin", "/lib", "/lib64", "/lib32", "/libx32"];
/** Mount points inside the sandbox: never probe these (or their ancestors) as "must be invisible". */
const SANDBOX_MOUNTS = ["/usr", "/etc", "/var", "/proc", "/dev", "/tmp", JOB, ...ROOT_LINKS];

type Config = { mode: "bwrap"; bwrap: string } | { mode: "off" } | { mode: "invalid"; error: string; message: string };

type Bwrap = { path: string; clearenv: boolean; disableUserns: boolean };
type Readiness = { ok: true; bwrap: Bwrap | null } | { ok: false; error: string; message: string };

type State = { selfTest?: Promise<Readiness>; selfTestKey?: string; reported?: boolean };
const g = globalThis as unknown as { __ftlConverterSandbox?: State };
const state: State = (g.__ftlConverterSandbox ??= {});

function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const mode = (env.CONVERTER_SANDBOX ?? "").trim().toLowerCase() || "bwrap";
  if (mode === "bwrap") return { mode: "bwrap", bwrap: env.BWRAP_PATH?.trim() || "/usr/bin/bwrap" };
  if (mode === "off") {
    if (env.NODE_ENV === "production") {
      return {
        mode: "invalid",
        error: "sandbox_off_in_production",
        message: "CONVERTER_SANDBOX=off is refused in production: PPTX conversions are disabled",
      };
    }
    return { mode: "off" };
  }
  return {
    mode: "invalid",
    error: "sandbox_misconfigured",
    message: `CONVERTER_SANDBOX=${JSON.stringify(mode)} is not "bwrap" or "off": PPTX conversions are disabled`,
  };
}

function childEnv(home: string): Record<string, string> {
  return { PATH: CHILD_PATH, HOME: home, LANG: CHILD_LOCALE, LC_ALL: CHILD_LOCALE, TMPDIR: `${home}/tmp` };
}

const OFF_WARNING =
  "[convert] !!! WARNING: CONVERTER_SANDBOX=off: LibreOffice runs WITHOUT a sandbox, with network and file access. Development only. !!!";

/**
 * Checks the configuration and (for bwrap) runs the one-time self-test. Memoised per process;
 * logs the outcome once. Safe to call at boot.
 */
export async function ensureConverterReady(): Promise<Readiness> {
  const config = readConfig();
  let result: Readiness;
  if (config.mode === "invalid") {
    // Logged every time: a misconfiguration must never be quiet.
    console.error(`[convert] SANDBOX MISCONFIGURED (${config.error}): ${config.message}`);
    return { ok: false, error: config.error, message: config.message };
  } else if (config.mode === "off") {
    result = { ok: true, bwrap: null };
  } else {
    if (!state.selfTest || state.selfTestKey !== config.bwrap) {
      state.selfTestKey = config.bwrap;
      state.reported = false;
      state.selfTest = selfTest(config.bwrap);
    }
    result = await state.selfTest;
  }
  if (!state.reported) {
    state.reported = true;
    if (!result.ok) {
      console.error(`[convert] SANDBOX NOT AVAILABLE (${result.error}): ${result.message}. PPTX conversions will be marked FAILED (fail closed); see README "PPTX conversion sandbox".`);
    } else if (!result.bwrap) {
      console.warn(OFF_WARNING);
    } else {
      console.log(
        `[convert] sandbox ready: ${result.bwrap.path}, no network, read-only /usr, private /tmp, job dir only${result.bwrap.disableUserns ? ", nested user namespaces blocked" : ""}`,
      );
    }
  }
  return result;
}

// ---------------------------------------------------------------------------------------------
// bubblewrap
// ---------------------------------------------------------------------------------------------

async function bwrapArgs(bwrap: Bwrap, hostJobDir: string, extraRoBinds: string[] = []): Promise<string[]> {
  const args = ["--unshare-all", "--die-with-parent", "--new-session"];
  if (bwrap.disableUserns) args.push("--unshare-user", "--disable-userns");
  if (bwrap.clearenv) {
    args.push("--clearenv");
    for (const [key, value] of Object.entries(childEnv(JOB))) args.push("--setenv", key, value);
  }
  args.push("--ro-bind", "/usr", "/usr");
  for (const link of ROOT_LINKS) {
    const stat = await fs.lstat(link).catch(() => null);
    if (stat?.isSymbolicLink()) args.push("--symlink", await fs.readlink(link), link);
    else if (stat?.isDirectory()) args.push("--ro-bind", link, link);
  }
  for (const dir of OPTIONAL_RO_BINDS) args.push("--ro-bind-try", dir, dir);
  args.push("--proc", "/proc", "--dev", "/dev", "--tmpfs", "/tmp");
  // After the tmpfs, so a LibreOffice installed under /tmp or /opt stays visible.
  for (const dir of extraRoBinds) args.push("--ro-bind", dir, dir);
  args.push("--bind", hostJobDir, JOB, "--chdir", JOB);
  return args;
}

type Outcome = { code: number | null; timedOut: boolean; spawnError?: string; stdout: string; stderr: string };

/** Spawns argv in its own process group with the minimal env; SIGKILLs the whole group on timeout. */
function launch(argv: string[], env: Record<string, string>, opts: { timeoutMs: number; captureStdout: boolean; lowPriority: boolean }): Promise<Outcome> {
  return new Promise<Outcome>((resolve) => {
    let settled = false;
    let stdout = "";
    let stderr = "";
    const stdio: StdioOptions = ["ignore", opts.captureStdout ? "pipe" : "ignore", "pipe"];
    // Explicit env: never process.env (DATABASE_URL, TELEGRAM_BOT_TOKEN, ...).
    const child = spawn(/* turbopackIgnore: true */ argv[0], argv.slice(1), { detached: true, env: env as NodeJS.ProcessEnv, stdio });
    const finish = (outcome: Omit<Outcome, "stdout" | "stderr">) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ...outcome, stdout, stderr });
    };
    if (opts.lowPriority && child.pid) {
      try {
        os.setPriority(child.pid, 19);
      } catch {
        // best effort
      }
    }
    child.stdout?.on("data", (chunk: Buffer) => {
      if (stdout.length < 64 * 1024) stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString("utf8")).slice(-2048);
    });
    const timer = setTimeout(() => {
      // The group holds nice/bwrap (or soffice when unsandboxed). Killing bwrap tears down its PID
      // namespace (--die-with-parent), so every LibreOffice process inside dies with it.
      try {
        if (child.pid) process.kill(-child.pid, "SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
      finish({ code: null, timedOut: true });
    }, opts.timeoutMs);
    child.on("error", (error: NodeJS.ErrnoException) => finish({ code: null, timedOut: false, spawnError: error.code ?? "spawn_failed" }));
    child.on("close", (code: number | null) => finish({ code, timedOut: false }));
  });
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Paths that must NOT be visible inside the sandbox; the self-test proves it. */
function secretPaths(): string[] {
  const candidates = [
    process.cwd(),
    path.join(/* turbopackIgnore: true */ process.cwd(), ".env"),
    process.env.MATERIALS_DIR,
    process.env.UPLOADS_DIR,
    os.homedir(),
    "/etc/passwd",
  ];
  const out: string[] = [];
  for (const p of candidates) {
    if (!p || !path.isAbsolute(p) || p === "/") continue;
    const clean = path.resolve(/* turbopackIgnore: true */ p);
    if (SANDBOX_MOUNTS.some((m) => m === clean || m.startsWith(`${clean}/`))) continue;
    out.push(clean);
  }
  return [...new Set(out)];
}

const SELF_TEST_SCRIPT = [
  "n=0",
  'while IFS= read -r l; do case "$l" in *:*) n=$((n+1));; esac; done < /proc/net/dev',
  '[ "$n" -eq 1 ] || { echo "network interfaces visible: $n" >&2; exit 4; }',
  'for p in "$@"; do [ -e "$p" ] && { echo "visible inside the sandbox: $p" >&2; exit 3; }; done',
  `: > ${JOB}/.w && rm ${JOB}/.w || { echo "job dir not writable" >&2; exit 5; }`,
  "exit 0",
].join("\n");

async function selfTest(bwrapPath: string): Promise<Readiness> {
  try {
    await fs.access(bwrapPath, fsConstants.X_OK);
  } catch {
    return { ok: false, error: "sandbox_missing", message: `bwrap not found or not executable at ${bwrapPath} (install bubblewrap or set BWRAP_PATH)` };
  }
  const help = await launch([bwrapPath, "--help"], childEnv("/"), { timeoutMs: 5_000, captureStdout: true, lowPriority: false });
  const helpText = help.stdout + help.stderr;
  const features = { clearenv: helpText.includes("--clearenv"), disableUserns: helpText.includes("--disable-userns") };

  const attempt = async (bwrap: Bwrap): Promise<Readiness> => {
    const job = await fs.mkdtemp(path.join(/* turbopackIgnore: true */ os.tmpdir(), "ftl-sandbox-test-"));
    try {
      const run = await runIn(bwrap, job, ["/usr/bin/sh", "-c", SELF_TEST_SCRIPT, "sh", ...secretPaths()], {
        timeoutMs: SELF_TEST_TIMEOUT_MS,
        captureStdout: false,
        lowPriority: false,
      });
      if (run.code === 0) return { ok: true, bwrap };
      const why = run.timedOut ? "timed out" : run.spawnError ? `spawn ${run.spawnError}` : `exit ${run.code}: ${run.stderr.trim().slice(-400)}`;
      return { ok: false, error: "sandbox_unavailable", message: `bwrap self-test failed (${why})` };
    } finally {
      await fs.rm(job, { recursive: true, force: true }).catch(() => {});
    }
  };

  const strict = await attempt({ path: bwrapPath, ...features });
  if (strict.ok || !features.disableUserns) return strict;
  // Some kernels/profiles refuse --disable-userns; everything else is still enforced without it.
  const relaxed = await attempt({ path: bwrapPath, ...features, disableUserns: false });
  if (relaxed.ok) console.warn("[convert] bwrap works only without --disable-userns; continuing without it");
  return relaxed.ok ? relaxed : strict;
}

type RunOptions = { timeoutMs: number; captureStdout: boolean; lowPriority: boolean; extraRoBinds?: string[]; nice?: string | null };

/** `nice -n 19 bwrap <args> -- argv` (nice execs bwrap, so the process group is still ours). */
async function runIn(bwrap: Bwrap | null, hostJobDir: string, argv: string[], opts: RunOptions): Promise<Outcome> {
  const prefix = opts.nice ? [opts.nice, "-n", "19"] : [];
  if (!bwrap) return launch([...prefix, ...argv], childEnv(hostJobDir), opts);
  const args = await bwrapArgs(bwrap, hostJobDir, opts.extraRoBinds);
  return launch([...prefix, bwrap.path, ...args, "--", ...argv], childEnv(JOB), opts);
}

/**
 * Runs an arbitrary command through the SAME wrapper and sandbox that conversions use (for
 * diagnostics and the security tests). `hostJobDir` is mounted at /job. Refuses when the sandbox
 * is not ready, exactly like conversions.
 */
export async function runSandboxed(argv: string[], hostJobDir: string, timeoutMs = 15_000): Promise<Outcome & { sandboxed: boolean }> {
  const ready = await ensureConverterReady();
  if (!ready.ok) throw new Error(`${ready.error}: ${ready.message}`);
  const outcome = await runIn(ready.bwrap, hostJobDir, argv, { timeoutMs, captureStdout: true, lowPriority: false });
  return { ...outcome, sandboxed: ready.bwrap !== null };
}

// ---------------------------------------------------------------------------------------------
// Conversion
// ---------------------------------------------------------------------------------------------

/**
 * Converts `inputPptx` to a PDF at `destPdf`. The job dir is created inside `workDir` (same
 * filesystem as `destPdf`), holds a COPY of the input, and is removed afterwards. Does not look
 * at the input's content: callers run pptxSafety first.
 */
export async function convertPptxToPdf(inputPptx: string, opts: { workDir: string; destPdf: string; timeoutMs?: number }): Promise<ConvertResult> {
  const ready = await ensureConverterReady();
  if (!ready.ok) return { ok: false, error: ready.error };
  if (!ready.bwrap) console.warn(OFF_WARNING);

  const soffice = process.env.SOFFICE_PATH || "/usr/bin/soffice";
  let sofficeReal: string;
  try {
    sofficeReal = await fs.realpath(/* turbopackIgnore: true */ soffice);
    await fs.access(/* turbopackIgnore: true */ sofficeReal, fsConstants.X_OK);
  } catch {
    return { ok: false, error: "soffice_missing" };
  }
  // A LibreOffice outside /usr (e.g. /opt/libreoffice25.8/program/soffice) needs its install dir
  // visible read-only. Never bind something that contains the app.
  const extraRoBinds: string[] = [];
  if (ready.bwrap && !sofficeReal.startsWith("/usr/")) {
    const root = path.dirname(path.dirname(sofficeReal));
    const cwd = process.cwd();
    if (root.split("/").filter(Boolean).length < 2 || cwd === root || cwd.startsWith(`${root}/`)) {
      console.error(`[convert] refusing to expose ${root} to the sandbox for SOFFICE_PATH`);
      return { ok: false, error: "sandbox_misconfigured" };
    }
    extraRoBinds.push(root);
  }

  const nicePath = process.env.NICE_PATH || "/usr/bin/nice";
  const nice = (await exists(nicePath)) ? nicePath : null;
  const timeoutMs = opts.timeoutMs ?? (Number(process.env.CONVERSION_TIMEOUT_MS) || 120_000);

  const jobDir = await fs.mkdtemp(path.join(/* turbopackIgnore: true */ opts.workDir, ".convert-"));
  try {
    for (const sub of ["out", "profile", "tmp"]) await fs.mkdir(path.join(/* turbopackIgnore: true */ jobDir, sub));
    await fs.copyFile(inputPptx, path.join(/* turbopackIgnore: true */ jobDir, "input.pptx"), fsConstants.COPYFILE_FICLONE);

    const base = ready.bwrap ? JOB : jobDir;
    const argv = [
      ready.bwrap ? sofficeReal : soffice,
      "--headless",
      "--invisible",
      "--nologo",
      "--nodefault",
      "--norestore",
      "--nolockcheck",
      "--nofirststartwizard",
      `-env:UserInstallation=${pathToFileURL(`${base}/profile`).href}`,
      "--convert-to",
      "pdf",
      "--outdir",
      `${base}/out`,
      `${base}/input.pptx`,
    ];
    const run = await runIn(ready.bwrap, jobDir, argv, { timeoutMs, captureStdout: false, lowPriority: !nice, extraRoBinds, nice });

    let error: string | null = null;
    if (run.timedOut) error = "timeout";
    else if (run.spawnError) error = run.spawnError === "ENOENT" ? "soffice_missing" : "spawn_failed";
    else if (run.code !== 0) {
      if (/^bwrap: /m.test(run.stderr)) error = /execvp/.test(run.stderr) ? "soffice_missing" : "sandbox_failed";
      else error = run.code === 126 || run.code === 127 ? "soffice_missing" : `exit_${run.code}`;
    }
    if (error) {
      if (run.stderr) console.error("[convert] soffice stderr:", run.stderr);
      return { ok: false, error };
    }
    return await collectOutput(path.join(/* turbopackIgnore: true */ jobDir, "out", "input.pdf"), opts.destPdf);
  } finally {
    await fs.rm(jobDir, { recursive: true, force: true }).catch((rmError) => console.error("[convert] could not remove job dir", rmError));
  }
}

/**
 * Copies the sandbox's output into place. The output dir was writable by the sandboxed process,
 * so never follow a symlink there and never rename its inode into our storage: open with
 * O_NOFOLLOW, check it is a regular PDF, copy the bytes into a file we create, then rename.
 */
async function collectOutput(produced: string, destPdf: string): Promise<ConvertResult> {
  let source: fs.FileHandle;
  try {
    source = await fs.open(produced, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  } catch (error) {
    return { ok: false, error: (error as NodeJS.ErrnoException).code === "ENOENT" ? "no_output" : "bad_output" };
  }
  const tmp = `${destPdf}.tmp-${randomBytes(6).toString("hex")}`;
  let target: fs.FileHandle | null = null;
  try {
    const stat = await source.stat();
    if (!stat.isFile() || stat.size < 5) return { ok: false, error: "bad_output" };
    if (stat.size > MAX_OUTPUT_BYTES) return { ok: false, error: "output_too_large" };
    const head = Buffer.alloc(5);
    await source.read(head, 0, 5, 0);
    if (head.toString("latin1") !== "%PDF-") return { ok: false, error: "bad_output" };

    target = await fs.open(tmp, "wx");
    const chunk = Buffer.alloc(1024 * 1024);
    let position = 0;
    for (;;) {
      const { bytesRead } = await source.read(chunk, 0, chunk.length, position);
      if (bytesRead === 0) break;
      position += bytesRead;
      if (position > MAX_OUTPUT_BYTES) return { ok: false, error: "output_too_large" };
      await target.write(chunk, 0, bytesRead);
    }
    await target.close();
    target = null;
    await fs.rename(tmp, destPdf);
    return { ok: true };
  } finally {
    await source.close().catch(() => {});
    if (target) await target.close().catch(() => {});
    await fs.rm(tmp, { force: true }).catch(() => {});
  }
}
