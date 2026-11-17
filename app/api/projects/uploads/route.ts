import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { requireAuthApi } from "@/lib/auth/permissions";
import { sanitizeFileName, sniffUpload } from "@/lib/server/fileSniff";
import { getMaterialsBaseDir, MATERIAL_MAX_BYTES, stagingDir } from "@/lib/server/materialStorage";

export const dynamic = "force-dynamic";

class TooLargeError extends Error {}

const STAGING_TTL_MS = 60 * 60 * 1000;

async function sweepStaging(dir: string) {
  try {
    const now = Date.now();
    for (const name of await fsp.readdir(dir)) {
      if (!name.endsWith(".bin") && !name.endsWith(".json")) continue;
      const full = path.join(/* turbopackIgnore: true */ dir, name);
      const stat = await fsp.stat(full).catch(() => null);
      if (stat && now - stat.mtimeMs > STAGING_TTL_MS) await fsp.unlink(full).catch(() => {});
    }
  } catch {
    // best effort
  }
}

export async function POST(request: Request) {
  const auth = await requireAuthApi();
  if (auth.error) return auth.error;

  if (!getMaterialsBaseDir()) return NextResponse.json({ error: "storage_not_configured" }, { status: 503 });

  let fileName: string;
  try {
    fileName = sanitizeFileName(decodeURIComponent(request.headers.get("x-file-name") ?? ""));
  } catch {
    return NextResponse.json({ error: "bad_name" }, { status: 400 });
  }
  const ext = path.extname(fileName).toLowerCase();
  if (!fileName || (ext !== ".pdf" && ext !== ".pptx")) {
    return NextResponse.json({ error: "bad_name" }, { status: 400 });
  }

  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MATERIAL_MAX_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }
  if (!request.body) return NextResponse.json({ error: "bad_file" }, { status: 400 });

  const dir = stagingDir();
  await fsp.mkdir(dir, { recursive: true });
  const uploadId = randomBytes(16).toString("hex");
  const binPath = path.join(/* turbopackIgnore: true */ dir, `${uploadId}.bin`);

  let size = 0;
  const counter = new Transform({
    transform(chunk: Buffer, _enc, callback) {
      size += chunk.length;
      if (size > MATERIAL_MAX_BYTES) callback(new TooLargeError());
      else callback(null, chunk);
    },
  });

  try {
    await pipeline(
      Readable.fromWeb(request.body as import("node:stream/web").ReadableStream),
      counter,
      fs.createWriteStream(binPath, { flags: "wx" }),
    );
  } catch (error) {
    await fsp.unlink(binPath).catch(() => {});
    if (error instanceof TooLargeError) return NextResponse.json({ error: "too_large" }, { status: 413 });
    console.error("[uploads] stream failed", error);
    return NextResponse.json({ error: "bad_file" }, { status: 400 });
  }

  // The name already passed as .pdf/.pptx, so unknown magic bytes (a renamed text
  // file, a password-protected PPTX, which is OLE and not a ZIP) and a kind that
  // does not match the extension are both a bad file, not an unsupported type.
  const kind = await sniffUpload(binPath);
  const expected = ext === ".pdf" ? "PDF" : "PPTX";
  if (size === 0 || kind !== expected) {
    await fsp.unlink(binPath).catch(() => {});
    return NextResponse.json({ error: "bad_file" }, { status: 400 });
  }

  await fsp.writeFile(
    path.join(/* turbopackIgnore: true */ dir, `${uploadId}.json`),
    JSON.stringify({ userId: auth.user.id, kind, size, fileName, createdAt: Date.now() }),
  );
  void sweepStaging(dir);

  return NextResponse.json({ uploadId, kind, size, fileName }, { status: 201 });
}
