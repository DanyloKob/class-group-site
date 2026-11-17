// NO "server-only" import: conversionQueue.ts (imported by instrumentation.ts) uses this module.
// Self-contained on purpose (node: built-ins only, erasable TypeScript) so the security tests can
// import it straight into node.
import fs from "node:fs/promises";
import zlib from "node:zlib";

/**
 * Static check of an UNTRUSTED .pptx before LibreOffice opens it (layer 1 of 3; the converter
 * sandbox and the minimal child environment are layers 2 and 3, see converterSandbox.ts).
 *
 * A PPTX is a zip of XML parts wired together by *.rels files. A crafted one can make LibreOffice
 * fetch things while it converts: linked images, media, OLE objects or templates with
 * TargetMode="External" (SSRF to http://169.254.169.254/, or file:///etc/passwd and the app's .env
 * rendered into the public PDF). This module refuses such files; the original upload stays
 * downloadable either way, only our own conversion is skipped.
 *
 * The zip reader is deliberately strict so it cannot disagree with LibreOffice's reader about what
 * the archive contains: every local header must match its central-directory entry, entries must
 * tile the file with no gaps or overlaps (no hidden entries a "repair" pass could find), names are
 * unique (case-insensitive), CRCs must match. Every part that looks like XML is scanned, whatever
 * its name. Nested packages (an embedded .xlsx/.docx) are scanned with the same rules.
 */

const MiB = 1024 * 1024;

export type PptxLimits = {
  /** Size of the .pptx file itself (uploads are capped at 80 MB). */
  maxFileBytes: number;
  /** Entries across the package and every nested package. */
  maxEntries: number;
  /** Declared uncompressed size of one entry. */
  maxEntryBytes: number;
  /** Declared uncompressed size of everything (zip-bomb guard). */
  maxTotalBytes: number;
  /** One XML part or one nested package held in memory for scanning. */
  maxXmlBytes: number;
  /** Nesting of packages inside packages. */
  maxDepth: number;
  /** Wall-clock budget for the whole check. */
  timeoutMs: number;
};

export const DEFAULT_PPTX_LIMITS: PptxLimits = {
  maxFileBytes: 96 * MiB,
  maxEntries: 10_000,
  maxEntryBytes: 256 * MiB,
  maxTotalBytes: 512 * MiB,
  maxXmlBytes: 32 * MiB,
  maxDepth: 2,
  timeoutMs: 20_000,
};

export type PptxVerdict =
  | { ok: true; entries: number; xmlParts: number; uncompressedBytes: number }
  | { ok: false; reason: string; part?: string };

/** Why a file is refused. `reason` is a short fixed code; `part` is the zip entry (untrusted text). */
class Refusal extends Error {
  reason: string;
  part: string | undefined;
  constructor(reason: string, part?: string) {
    super(reason);
    this.reason = reason;
    this.part = part;
  }
}

type Budget = { deadline: number; total: number; entries: number; xmlParts: number; limits: PptxLimits };

/**
 * Inspects the package at `filePath`. Never throws: anything unexpected becomes a refusal
 * (fail closed).
 */
export async function inspectPptx(filePath: string, overrides: Partial<PptxLimits> = {}): Promise<PptxVerdict> {
  const limits: PptxLimits = { ...DEFAULT_PPTX_LIMITS, ...overrides };
  const budget: Budget = { deadline: Date.now() + limits.timeoutMs, total: 0, entries: 0, xmlParts: 0, limits };
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) return { ok: false, reason: "not_a_file" };
    if (stat.size > limits.maxFileBytes) return { ok: false, reason: "file_too_large" };
    const buf = await fs.readFile(filePath);
    await scanPackage(buf, 0, budget, "");
    return { ok: true, entries: budget.entries, xmlParts: budget.xmlParts, uncompressedBytes: budget.total };
  } catch (error) {
    if (error instanceof Refusal) return { ok: false, reason: error.reason, part: error.part };
    console.error("[pptx-safety] unexpected error", error);
    return { ok: false, reason: "inspect_error" };
  }
}

function checkTime(budget: Budget, part?: string) {
  if (Date.now() > budget.deadline) throw new Refusal("inspect_timeout", part);
}

// ---------------------------------------------------------------------------------------------
// Zip container
// ---------------------------------------------------------------------------------------------

type ZipEntry = {
  name: string;
  key: string;
  nameBytes: Buffer;
  flags: number;
  method: number;
  crc: number;
  csize: number;
  usize: number;
  localOffset: number;
  dataStart: number;
  dataEnd: number;
};

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;
const SIG_ZIP64_LOCATOR = 0x07064b50;
const SIG_DESCRIPTOR = 0x08074b50;
const FLAG_ENCRYPTED = 0x0001 | 0x0040 | 0x2000; // traditional, strong, masked central directory
const FLAG_DESCRIPTOR = 0x0008;
const FLAG_UTF8 = 0x0800;

/** Lookup key for a part name: forward slashes, no leading slash, case-insensitive (OPC). */
function partKey(name: string): string {
  return name.replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();
}

function readZip(buf: Buffer, budget: Budget, where: string): ZipEntry[] {
  const refuse = (reason: string, part?: string) => new Refusal(reason, where + (part ?? ""));
  if (buf.length < 22) throw refuse("zip_invalid");

  let eocd = -1;
  for (let i = buf.length - 22, stop = Math.max(0, buf.length - 65_557); i >= stop; i--) {
    if (buf.readUInt32LE(i) === SIG_EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw refuse("zip_invalid");

  const disk = buf.readUInt16LE(eocd + 4);
  const cdDisk = buf.readUInt16LE(eocd + 6);
  const countOnDisk = buf.readUInt16LE(eocd + 8);
  const count = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const commentLen = buf.readUInt16LE(eocd + 20);
  if (
    count === 0xffff ||
    cdSize === 0xffffffff ||
    cdOffset === 0xffffffff ||
    (eocd >= 20 && buf.readUInt32LE(eocd - 20) === SIG_ZIP64_LOCATOR)
  ) {
    throw refuse("zip64_unsupported");
  }
  if (disk !== 0 || cdDisk !== 0 || countOnDisk !== count || count === 0) throw refuse("zip_invalid");
  // The central directory must end exactly where the end record starts, and nothing that looks
  // like a zip record may follow the end record: no room for a second archive or hidden entries.
  // A few stray bytes after it (some uploaders append a newline) are tolerated.
  const trailing = buf.length - (eocd + 22 + commentLen);
  if (cdOffset + cdSize !== eocd || trailing < 0 || trailing > 4096) throw refuse("zip_inconsistent");
  if (trailing > 0 && buf.subarray(eocd + 22 + commentLen).includes("PK")) throw refuse("zip_inconsistent");

  budget.entries += count;
  if (budget.entries > budget.limits.maxEntries) throw refuse("too_many_entries");

  const entries: ZipEntry[] = [];
  const seen = new Set<string>();
  let pos = cdOffset;
  for (let n = 0; n < count; n++) {
    if (pos + 46 > eocd || buf.readUInt32LE(pos) !== SIG_CENTRAL) throw refuse("zip_invalid");
    const flags = buf.readUInt16LE(pos + 8);
    const method = buf.readUInt16LE(pos + 10);
    const crc = buf.readUInt32LE(pos + 16);
    const csize = buf.readUInt32LE(pos + 20);
    const usize = buf.readUInt32LE(pos + 24);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const entryCommentLen = buf.readUInt16LE(pos + 32);
    const diskStart = buf.readUInt16LE(pos + 34);
    const localOffset = buf.readUInt32LE(pos + 42);
    const next = pos + 46 + nameLen + extraLen + entryCommentLen;
    if (next > eocd) throw refuse("zip_invalid");

    const nameBytes = buf.subarray(pos + 46, pos + 46 + nameLen);
    if (nameLen === 0 || nameBytes.includes(0)) throw refuse("zip_invalid");
    const name = nameBytes.toString(flags & FLAG_UTF8 ? "utf8" : "latin1");

    if (csize === 0xffffffff || usize === 0xffffffff || localOffset === 0xffffffff) throw refuse("zip64_unsupported", name);
    if (diskStart !== 0) throw refuse("zip_invalid", name);
    if (flags & FLAG_ENCRYPTED) throw refuse("zip_encrypted", name);
    if (method !== 0 && method !== 8) throw refuse("zip_method_unsupported", name);
    if (method === 0 && csize !== usize) throw refuse("zip_inconsistent", name);
    if (usize > budget.limits.maxEntryBytes) throw refuse("entry_too_large", name);
    budget.total += usize;
    if (budget.total > budget.limits.maxTotalBytes) throw refuse("too_large_uncompressed", name);

    const key = partKey(name);
    if (seen.has(key)) throw refuse("zip_duplicate_entry", name);
    seen.add(key);

    entries.push({ name, key, nameBytes, flags, method, crc, csize, usize, localOffset, dataStart: 0, dataEnd: 0 });
    pos = next;
  }
  if (pos !== eocd) throw refuse("zip_inconsistent");

  // Local headers: each must repeat its central-directory entry, and together the entries must
  // tile [0, cdOffset) exactly. A gap could hide a local entry that a lenient reader would use.
  const byOffset = [...entries].sort((a, b) => a.localOffset - b.localOffset);
  let expected = 0;
  for (const e of byOffset) {
    const p = e.localOffset;
    if (p !== expected || p + 30 > cdOffset || buf.readUInt32LE(p) !== SIG_LOCAL) throw refuse("zip_inconsistent", e.name);
    const localFlags = buf.readUInt16LE(p + 6);
    const localMethod = buf.readUInt16LE(p + 8);
    const localCrc = buf.readUInt32LE(p + 14);
    const localCsize = buf.readUInt32LE(p + 18);
    const localUsize = buf.readUInt32LE(p + 22);
    const localNameLen = buf.readUInt16LE(p + 26);
    const localExtraLen = buf.readUInt16LE(p + 28);
    const hasDescriptor = (e.flags & FLAG_DESCRIPTOR) !== 0;
    if (
      localMethod !== e.method ||
      (localFlags & FLAG_DESCRIPTOR) !== (e.flags & FLAG_DESCRIPTOR) ||
      (localFlags & FLAG_ENCRYPTED) !== 0 ||
      localNameLen !== e.nameBytes.length ||
      p + 30 + localNameLen > cdOffset ||
      !buf.subarray(p + 30, p + 30 + localNameLen).equals(e.nameBytes)
    ) {
      throw refuse("zip_inconsistent", e.name);
    }
    const sizesMatch = localCrc === e.crc && localCsize === e.csize && localUsize === e.usize;
    const sizesDeferred =
      (localCrc === 0 || localCrc === e.crc) && (localCsize === 0 || localCsize === e.csize) && (localUsize === 0 || localUsize === e.usize);
    if (hasDescriptor ? !sizesDeferred : !sizesMatch) throw refuse("zip_inconsistent", e.name);

    e.dataStart = p + 30 + localNameLen + localExtraLen;
    e.dataEnd = e.dataStart + e.csize;
    if (e.dataEnd > cdOffset) throw refuse("zip_inconsistent", e.name);
    let end = e.dataEnd;
    if (hasDescriptor) {
      if (end + 4 <= cdOffset && buf.readUInt32LE(end) === SIG_DESCRIPTOR) end += 4;
      if (
        end + 12 > cdOffset ||
        buf.readUInt32LE(end) !== e.crc ||
        buf.readUInt32LE(end + 4) !== e.csize ||
        buf.readUInt32LE(end + 8) !== e.usize
      ) {
        throw refuse("zip_inconsistent", e.name);
      }
      end += 12;
    }
    expected = end;
  }
  if (expected !== cdOffset) throw refuse("zip_inconsistent");
  return entries;
}

const HEAD_BYTES = 1024;

/**
 * Decompresses one entry, verifying its size and CRC. Returns the bytes when the entry is small
 * enough to scan (≤ maxXmlBytes); for bigger entries only the head is kept to prove it is neither
 * XML nor a nested package, and null is returned.
 */
function extract(buf: Buffer, e: ZipEntry, budget: Budget, label: string): Promise<Buffer | null> {
  const keepAll = e.usize <= budget.limits.maxXmlBytes;
  const ensureBinaryHead = (head: Buffer, complete: boolean) => {
    const kind = classify(head, complete, label);
    if (kind === "xml") throw new Refusal("xml_part_too_large", label);
    if (kind === "zip") throw new Refusal("nested_package_too_large", label);
  };

  if (e.method === 0) {
    const data = buf.subarray(e.dataStart, e.dataEnd);
    if (zlib.crc32(data) !== e.crc) return Promise.reject(new Refusal("zip_crc_mismatch", label));
    if (keepAll) return Promise.resolve(data);
    try {
      ensureBinaryHead(data.subarray(0, HEAD_BYTES), data.length <= HEAD_BYTES);
    } catch (error) {
      return Promise.reject(error);
    }
    return Promise.resolve(null);
  }

  return new Promise<Buffer | null>((resolve, reject) => {
    const inflater = zlib.createInflateRaw({ chunkSize: 64 * 1024 });
    const kept: Buffer[] = [];
    let keptBytes = 0;
    let headChecked = keepAll;
    let size = 0;
    let crc = 0;
    let done = false;
    const stop = (error: unknown) => {
      if (done) return;
      done = true;
      inflater.destroy();
      reject(error);
    };
    inflater.on("data", (chunk: Buffer) => {
      if (done) return;
      size += chunk.length;
      // The declared size is already capped, so this is the zip-bomb guard for lying headers.
      if (size > e.usize) return stop(new Refusal("zip_size_mismatch", label));
      if (Date.now() > budget.deadline) return stop(new Refusal("inspect_timeout", label));
      crc = zlib.crc32(chunk, crc);
      if (keepAll || !headChecked) {
        kept.push(chunk);
        keptBytes += chunk.length;
      }
      if (!headChecked && keptBytes >= HEAD_BYTES) {
        try {
          ensureBinaryHead(Buffer.concat(kept, keptBytes).subarray(0, HEAD_BYTES), false);
        } catch (error) {
          return stop(error);
        }
        headChecked = true;
        kept.length = 0;
        keptBytes = 0;
      }
    });
    inflater.on("error", () => stop(new Refusal("zip_corrupt", label)));
    inflater.on("end", () => {
      if (done) return;
      done = true;
      if (size !== e.usize) return reject(new Refusal("zip_size_mismatch", label));
      if (crc !== e.crc) return reject(new Refusal("zip_crc_mismatch", label));
      if (keepAll) return resolve(Buffer.concat(kept, keptBytes));
      if (!headChecked) {
        try {
          ensureBinaryHead(Buffer.concat(kept, keptBytes), true);
        } catch (error) {
          return reject(error);
        }
      }
      resolve(null);
    });
    inflater.end(buf.subarray(e.dataStart, e.dataEnd));
  });
}

// ---------------------------------------------------------------------------------------------
// Content sniffing and decoding
// ---------------------------------------------------------------------------------------------

function isXmlSpace(c: number): boolean {
  return c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d;
}

/**
 * "xml" for anything an XML parser would accept as a document start, "zip" for a nested package,
 * otherwise "binary". XML in an encoding we do not decode (UTF-16 without a BOM, UCS-4, EBCDIC) is
 * refused, because scanning its raw bytes would miss what LibreOffice sees.
 */
function classify(head: Buffer, complete: boolean, label: string): "xml" | "zip" | "binary" {
  const h = head;
  const at = (i: number) => (i < h.length ? h[i] : -1);
  if (at(0) === 0x50 && at(1) === 0x4b && at(2) === 0x03 && at(3) === 0x04) return "zip";

  const ucs4 =
    (at(0) === 0 && at(1) === 0 && at(2) === 0 && at(3) === 0x3c && at(4) === 0 && at(5) === 0 && at(6) === 0) ||
    (at(0) === 0x3c && at(1) === 0 && at(2) === 0 && at(3) === 0 && at(5) === 0 && at(6) === 0 && at(7) === 0) ||
    (at(0) === 0 && at(1) === 0 && at(2) === 0x3c && at(3) === 0 && at(4) === 0 && at(5) === 0 && at(7) === 0) ||
    (at(0) === 0 && at(1) === 0x3c && at(2) === 0 && at(3) === 0 && at(4) === 0 && at(6) === 0 && at(7) === 0) ||
    (at(0) === 0 && at(1) === 0 && at(2) === 0xfe && at(3) === 0xff) ||
    (at(0) === 0xff && at(1) === 0xfe && at(2) === 0 && at(3) === 0);
  const utf16NoBom = (at(0) === 0 && at(1) === 0x3c && at(2) === 0 && at(3) === 0x3f) || (at(0) === 0x3c && at(1) === 0 && at(2) === 0x3f && at(3) === 0);
  const ebcdic = at(0) === 0x4c && at(1) === 0x6f && at(2) === 0xa7 && at(3) === 0x94;
  if (ucs4 || utf16NoBom || ebcdic) throw new Refusal("xml_encoding", label);

  if ((at(0) === 0xff && at(1) === 0xfe) || (at(0) === 0xfe && at(1) === 0xff)) {
    const le = at(0) === 0xff;
    for (let i = 2; i + 1 < h.length; i += 2) {
      const c = le ? h[i] | (h[i + 1] << 8) : (h[i] << 8) | h[i + 1];
      if (isXmlSpace(c)) continue;
      return c === 0x3c ? "xml" : "binary";
    }
    return complete ? "binary" : "xml";
  }

  let i = at(0) === 0xef && at(1) === 0xbb && at(2) === 0xbf ? 3 : 0;
  while (i < h.length && isXmlSpace(h[i])) i++;
  if (i < h.length) return h[i] === 0x3c ? "xml" : "binary";
  // Nothing but whitespace so far: harmless if that is the whole entry, suspicious otherwise.
  return complete || h.length === 0 ? "binary" : "xml";
}

/** Declared encodings that agree with decoding the bytes as UTF-8 (UTF-16 is only read with a BOM). */
const UTF8_COMPATIBLE = new Set(["utf-8", "utf8", "us-ascii", "ascii"]);

function decodeXml(data: Buffer, label: string, lenient: boolean): string {
  try {
    // fatal: invalid byte sequences are refused (strict parts); for VML they become U+FFFD, which
    // never changes the ASCII markup the rules look at.
    const fatal = !lenient;
    if (data[0] === 0xff && data[1] === 0xfe) return new TextDecoder("utf-16le", { fatal, ignoreBOM: true }).decode(data.subarray(2));
    if (data[0] === 0xfe && data[1] === 0xff) return new TextDecoder("utf-16be", { fatal, ignoreBOM: true }).decode(data.subarray(2));
    const body = data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf ? data.subarray(3) : data;
    const text = new TextDecoder("utf-8", { fatal, ignoreBOM: true }).decode(body);
    if (text.startsWith("<?xml")) {
      const declEnd = text.indexOf("?>");
      const decl = declEnd > 0 && declEnd < 512 ? text.slice(0, declEnd) : "";
      const match = /\sencoding\s*=\s*["']([^"']{0,40})["']/.exec(decl);
      const declared = match?.[1].trim().toLowerCase();
      if (declared && !UTF8_COMPATIBLE.has(declared)) throw new Refusal("xml_encoding", label);
    }
    return text;
  } catch (error) {
    if (error instanceof Refusal) throw error;
    throw new Refusal("xml_encoding", label);
  }
}

// ---------------------------------------------------------------------------------------------
// Package scan
// ---------------------------------------------------------------------------------------------

type Rel = { external: boolean; target: string; base: string };
type PackageState = { keys: Set<string>; rels: Map<string, Map<string, Rel>> };

async function scanPackage(buf: Buffer, depth: number, budget: Budget, where: string): Promise<void> {
  checkTime(budget, where || undefined);
  const entries = readZip(buf, budget, where);
  const pkg: PackageState = { keys: new Set(entries.map((e) => e.key)), rels: new Map() };

  if (depth === 0) {
    if (!pkg.keys.has("[content_types].xml") || !pkg.keys.has("ppt/presentation.xml")) throw new Refusal("not_pptx");
    // An OpenDocument package wearing a .pptx name would take LibreOffice's ODF import path.
    if (pkg.keys.has("mimetype") || pkg.keys.has("meta-inf/manifest.xml")) throw new Refusal("not_pptx");
  }

  // Relationship parts first, so every other part can resolve its r:* references.
  const isRels = (e: ZipEntry) => e.key.endsWith(".rels");
  const ordered = [...entries.filter(isRels), ...entries.filter((e) => !isRels(e))];
  for (const e of ordered) {
    const label = where + e.name;
    checkTime(budget, label);
    const content = await extract(buf, e, budget, label);
    if (!content || content.length === 0) continue;
    const kind = classify(content.subarray(0, HEAD_BYTES), content.length <= HEAD_BYTES, label);
    if (kind === "xml") {
      budget.xmlParts++;
      // Legacy VML is HTML-like (<![if ...]>, <br>, unquoted values) and LibreOffice repairs it
      // before parsing, so it gets a tolerant tokenizer. Every rule still applies to it.
      const lenient = e.key.endsWith(".vml");
      scanXmlPart(decodeXml(content, label, lenient), e.key, label, pkg, budget, lenient);
    } else if (kind === "zip") {
      if (depth + 1 > budget.limits.maxDepth) throw new Refusal("nested_too_deep", label);
      await scanPackage(content, depth + 1, budget, `${label}!/`);
    }
  }
}

const REL_NAMESPACES = new Set([
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  "http://purl.oclc.org/ooxml/officeDocument/relationships",
]);
const HYPERLINK_TYPES = new Set([
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink",
  "http://purl.oclc.org/ooxml/officeDocument/relationships/hyperlink",
]);
/** Elements whose r:id may point at an external hyperlink relationship (a click target, never fetched). */
const HYPERLINK_ELEMENTS = new Set(["hlinkclick", "hlinkhover", "hlinkmouseover", "hyperlink"]);
const LINK_SCHEMES = new Set(["http", "https", "mailto"]);

/** Removes whitespace and control characters anywhere: URL parsers drop many of them. */
function squash(value: string): string {
  return value.replace(/[\u0000-\u0020\u007f-\u009f\u00a0\u1680\u2000-\u200f\u2028\u2029\u202f\u205f\u3000\ufeff]/g, "");
}

function schemeOf(lower: string): string | null {
  const match = /^([a-z][a-z0-9+.-]*):/.exec(lower);
  return match ? match[1] : null;
}

function safeCode(value: string): string {
  return value.replace(/[^A-Za-z0-9+._-]/g, "").slice(0, 40) || "unknown";
}

function dirOf(key: string): string {
  const slash = key.lastIndexOf("/");
  return slash < 0 ? "" : key.slice(0, slash + 1);
}

/** "ppt/slides/_rels/slide1.xml.rels" -> "ppt/slides/" (the source part's folder). */
function relsBase(key: string): string {
  const match = /^(.*?)_rels\/[^/]*\.rels$/.exec(key);
  return match ? match[1] : dirOf(key);
}

/** "ppt/slides/slide1.xml" -> "ppt/slides/_rels/slide1.xml.rels" */
function relsKeyFor(key: string): string {
  const dir = dirOf(key);
  return `${dir}_rels/${key.slice(dir.length)}.rels`;
}

/** Resolves a relative part reference inside the package; null when it climbs above the root. */
function resolveInside(base: string, ref: string): string | null {
  const clean = ref.replace(/\\/g, "/").split("#")[0];
  const joined = clean.startsWith("/") ? clean : base + clean;
  const out: string[] = [];
  for (const segment of joined.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (out.length === 0) return null;
      out.pop();
      continue;
    }
    out.push(segment);
  }
  return out.join("/").toLowerCase();
}

function hasPart(pkg: PackageState, key: string): boolean {
  if (pkg.keys.has(key)) return true;
  try {
    return pkg.keys.has(decodeURIComponent(key));
  } catch {
    return false;
  }
}

type Attr = { qname: string; prefix: string; local: string; value: string };

function scanXmlPart(text: string, key: string, label: string, pkg: PackageState, budget: Budget, lenient: boolean): void {
  const ns = new Map<string, string>();
  const undo: Array<[string, string | undefined]> = [];
  const marks: number[] = [];
  const elements: string[] = [];
  const myRels = new Map<string, Rel>();
  const relsForMe = pkg.rels.get(relsKeyFor(key));
  const base = relsBase(key);

  const checkRelationship = (attrs: Attr[]) => {
    const get = (name: string) => {
      const found = attrs.filter((a) => a.local.toLowerCase() === name);
      if (found.length > 1) throw new Refusal("xml_malformed", label);
      return found[0]?.value;
    };
    const id = (get("id") ?? "").trim();
    const type = (get("type") ?? "").trim();
    const target = get("target") ?? "";
    const mode = get("targetmode");
    // Anything but an explicit Internal counts as external (fail closed on odd spellings).
    const external = mode !== undefined && mode.trim().toLowerCase() !== "internal";

    const flat = squash(target).toLowerCase();
    if (/^[\\/][\\/]/.test(flat)) throw new Refusal("unc_path", label);
    const scheme = schemeOf(flat);
    if (flat.startsWith("\\") || (scheme && scheme.length === 1)) throw new Refusal("absolute_path", label);
    if (scheme && !LINK_SCHEMES.has(scheme)) throw new Refusal(`bad_target_scheme:${safeCode(scheme)}`, label);
    if (external) {
      if (!HYPERLINK_TYPES.has(type)) {
        const short = type.slice(type.lastIndexOf("/") + 1);
        throw new Refusal(`external_relationship:${safeCode(short)}`, label);
      }
      // http(s)/mailto, or a relative click target such as "Report.docx" (PowerPoint writes those
      // for links to nearby files). checkRelReference makes sure it is only ever clicked, never fetched.
      if (!scheme && flat.startsWith("/")) throw new Refusal("absolute_path", label);
    } else {
      if (scheme) throw new Refusal(`bad_target_scheme:${safeCode(scheme)}`, label);
      if (flat.startsWith("/")) {
        // "/ppt/slides/slide1.xml" is a legal package-absolute part name; anything else is a path.
        const absolute = resolveInside("", target.trim());
        if (absolute === null || !hasPart(pkg, absolute)) throw new Refusal("absolute_path", label);
      } else if (resolveInside(base, target.trim()) === null) {
        throw new Refusal("path_escape", label);
      }
    }
    if (myRels.has(id)) throw new Refusal("xml_duplicate_id", label);
    myRels.set(id, { external, target: target.trim(), base });
  };

  const checkRelReference = (element: string, attr: string, value: string) => {
    const id = value.trim();
    const rel = relsForMe?.get(id);
    const isLink = attr === "link" || attr === "href";
    if (!rel) {
      if (isLink) throw new Refusal("linked_content", label);
      return;
    }
    if (rel.external) {
      // A hyperlink relationship is only safe where it is used as a click target. Referenced from
      // a picture, media or object it would be fetched (r:link to a "hyperlink" typed rel).
      if (attr === "id" && HYPERLINK_ELEMENTS.has(element)) return;
      throw new Refusal("external_reference", label);
    }
    if (isLink) {
      const resolved = resolveInside(rel.base, rel.target);
      if (resolved === null || !hasPart(pkg, resolved)) throw new Refusal("linked_content", label);
    }
  };

  const checkHref = (element: string, value: string) => {
    const flat = squash(value);
    const lower = flat.toLowerCase();
    if (!flat || flat.startsWith("#") || lower.startsWith("data:")) return;
    if (/^[\\/][\\/]/.test(lower)) throw new Refusal("unc_path", label);
    const scheme = schemeOf(lower);
    if (lower.startsWith("/") || lower.startsWith("\\") || (scheme && scheme.length === 1)) throw new Refusal("absolute_path", label);
    if (scheme) {
      if (element === "a" && LINK_SCHEMES.has(scheme)) return; // a click target, never fetched
      throw new Refusal(`external_reference:${safeCode(scheme)}`, label);
    }
    if (resolveInside(dirOf(key), flat) === null) throw new Refusal("path_escape", label);
  };

  const onStart = (qname: string, attrs: Attr[], selfClosing: boolean) => {
    const mark = undo.length;
    for (const a of attrs) {
      if (a.qname === "xmlns" || a.prefix === "xmlns") {
        const prefix = a.qname === "xmlns" ? "" : a.local;
        undo.push([prefix, ns.get(prefix)]);
        ns.set(prefix, a.value.trim());
      }
    }
    const colon = qname.indexOf(":");
    const prefix = colon < 0 ? "" : qname.slice(0, colon);
    const local = (colon < 0 ? qname : qname.slice(colon + 1)).toLowerCase();
    const parent = elements.length ? elements[elements.length - 1] : "";

    if (local === "relationship") checkRelationship(attrs);
    // Linked (not embedded) OLE: <p:oleObj><p:link/></p:oleObj>, and VML's o:LinkType / Type="Link".
    if ((local === "link" && (prefix !== "" || parent === "oleobj")) || local === "linktype") {
      throw new Refusal("linked_ole", label);
    }
    if (local === "oleobject" && attrs.some((a) => a.local.toLowerCase() === "type" && a.value.trim().toLowerCase() === "link")) {
      throw new Refusal("linked_ole", label);
    }

    for (const a of attrs) {
      if (a.qname === "xmlns" || a.prefix === "xmlns") continue;
      const attrLocal = a.local.toLowerCase();
      // r:id, r:embed, r:link, ... in the relationships namespace (any prefix), plus VML's o:relid.
      const isRelRef = (a.prefix !== "" && (a.prefix === "r" || REL_NAMESPACES.has(ns.get(a.prefix) ?? ""))) || attrLocal === "relid";
      if (isRelRef) checkRelReference(local, attrLocal, a.value);
      else if (attrLocal === "href" || attrLocal === "src") checkHref(local, a.value);
    }

    if (selfClosing) {
      restore(mark);
    } else {
      marks.push(mark);
      elements.push(local);
    }
  };

  const restore = (mark: number) => {
    while (undo.length > mark) {
      const [prefix, previous] = undo.pop()!;
      if (previous === undefined) ns.delete(prefix);
      else ns.set(prefix, previous);
    }
  };

  const onEnd = () => {
    elements.pop();
    restore(marks.pop() ?? 0);
  };

  tokenize(text, label, budget, lenient, onStart, onEnd);
  if (myRels.size > 0) pkg.rels.set(key, myRels);
}

// ---------------------------------------------------------------------------------------------
// A small, linear-time, well-formedness-checking XML tokenizer (no DTDs, no entities beyond the
// five predefined ones and character references, exactly like OOXML allows).
// ---------------------------------------------------------------------------------------------

const PREDEFINED: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };

function decodeEntities(raw: string, label: string, lenient: boolean): string {
  if (!raw.includes("&")) return raw;
  let out = "";
  let k = 0;
  for (;;) {
    const amp = raw.indexOf("&", k);
    if (amp < 0) return out + raw.slice(k);
    out += raw.slice(k, amp);
    const semi = raw.indexOf(";", amp);
    if (semi < 0 || semi - amp > 12) {
      if (!lenient) throw new Refusal("xml_malformed", label);
      out += "&";
      k = amp + 1;
      continue;
    }
    const name = raw.slice(amp + 1, semi);
    if (name.startsWith("#")) {
      const code = name[1] === "x" ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
      const digitsOk = name[1] === "x" ? /^#x[0-9a-fA-F]+$/.test(name) : /^#[0-9]+$/.test(name);
      if (!digitsOk || !Number.isFinite(code) || code < 1 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) {
        throw new Refusal("xml_malformed", label);
      }
      out += String.fromCodePoint(code);
    } else if (Object.prototype.hasOwnProperty.call(PREDEFINED, name)) {
      out += PREDEFINED[name];
    } else if (lenient) {
      out += `&${name};`;
    } else {
      throw new Refusal("xml_malformed", label); // no DTD, so any other entity is undefined
    }
    k = semi + 1;
  }
}

function isNameStop(c: string): boolean {
  return c === " " || c === "\t" || c === "\n" || c === "\r" || c === "/" || c === ">" || c === "=";
}

function tokenize(
  text: string,
  label: string,
  budget: Budget,
  lenient: boolean,
  onStart: (qname: string, attrs: Attr[], selfClosing: boolean) => void,
  onEnd: () => void,
): void {
  const malformed = () => new Refusal("xml_malformed", label);
  const n = text.length;
  const stack: string[] = [];
  let tags = 0;
  let i = 0;
  const skipSpace = (j: number) => {
    while (j < n && isXmlSpace(text.charCodeAt(j))) j++;
    return j;
  };

  while (i < n) {
    const lt = text.indexOf("<", i);
    if (lt < 0) break;
    i = lt;
    if (++tags % 4096 === 0) checkTime(budget, label);

    if (text.startsWith("<!--", i)) {
      const end = text.indexOf("-->", i + 4);
      if (end < 0) throw malformed();
      i = end + 3;
      continue;
    }
    if (text.startsWith("<![CDATA[", i)) {
      const end = text.indexOf("]]>", i + 9);
      if (end < 0) throw malformed();
      i = end + 3;
      continue;
    }
    if (text.startsWith("<!", i)) {
      if (text.slice(i, i + 9).toUpperCase() !== "<!DOCTYPE") {
        if (!lenient) throw malformed();
        // VML conditional markers: <![if gte mso 9]> ... <![endif]>
        const end = text.indexOf(">", i + 2);
        if (end < 0) throw malformed();
        i = end + 1;
        continue;
      }
      // Only a plain DOCTYPE is tolerated (SVG files often carry the W3C one). An internal subset
      // can declare entities (XXE, billion laughs); an external one must not point anywhere else.
      let j = i + 9;
      let quote = "";
      let literalStart = 0;
      const literals: string[] = [];
      for (; j < n; j++) {
        const c = text[j];
        if (quote) {
          if (c === quote) {
            literals.push(text.slice(literalStart, j));
            quote = "";
          }
          continue;
        }
        if (c === '"' || c === "'") {
          quote = c;
          literalStart = j + 1;
          continue;
        }
        if (c === "[") throw new Refusal("xml_doctype", label);
        if (c === ">") break;
      }
      if (j >= n) throw malformed();
      const systemId = literals.length ? literals[literals.length - 1] : "";
      if (literals.length && !systemId.startsWith("http://www.w3.org/")) throw new Refusal("xml_doctype", label);
      i = j + 1;
      continue;
    }
    if (text.startsWith("<?", i)) {
      const end = text.indexOf("?>", i + 2);
      if (end < 0) throw malformed();
      let j = i + 2;
      while (j < end && !isXmlSpace(text.charCodeAt(j))) j++;
      const target = text.slice(i + 2, j).toLowerCase();
      if (target === "xml" && i !== 0) throw malformed();
      if (target === "xml-stylesheet") throw new Refusal("xml_stylesheet", label);
      i = end + 2;
      continue;
    }
    if (text.startsWith("</", i)) {
      const end = text.indexOf(">", i + 2);
      if (end < 0) throw malformed();
      const name = text.slice(i + 2, end).trimEnd();
      if (!lenient) {
        if (stack.pop() !== name) throw malformed();
        onEnd();
      } else {
        // HTML-style VML: close whatever was left open inside, ignore a stray end tag.
        const at = stack.lastIndexOf(name);
        while (at >= 0 && stack.length > at) {
          stack.pop();
          onEnd();
        }
      }
      i = end + 1;
      continue;
    }

    // Start tag.
    let j = i + 1;
    while (j < n && !isNameStop(text[j])) j++;
    const qname = text.slice(i + 1, j);
    if (!qname || /[<"'&]/.test(qname)) throw malformed();
    const attrs: Attr[] = [];
    const names = new Set<string>();
    let selfClosing = false;
    for (;;) {
      const before = j;
      j = skipSpace(j);
      if (j >= n) throw malformed();
      if (text[j] === ">") {
        j++;
        break;
      }
      if (text[j] === "/") {
        if (text[j + 1] !== ">") throw malformed();
        selfClosing = true;
        j += 2;
        break;
      }
      if (j === before && !lenient) throw malformed(); // attributes must be separated by whitespace
      const nameStart = j;
      while (j < n && !isNameStop(text[j])) j++;
      const attrName = text.slice(nameStart, j);
      if (!attrName || /[<"'&]/.test(attrName) || (names.has(attrName) && !lenient)) throw malformed();
      names.add(attrName);
      j = skipSpace(j);
      let raw: string;
      if (text[j] !== "=") {
        if (!lenient) throw malformed();
        raw = ""; // HTML-style attribute without a value
      } else {
        j = skipSpace(j + 1);
        const quote = text[j];
        if (quote === '"' || quote === "'") {
          const close = text.indexOf(quote, j + 1);
          if (close < 0) throw malformed();
          raw = text.slice(j + 1, close);
          if (raw.includes("<") && !lenient) throw malformed();
          j = close + 1;
        } else {
          if (!lenient) throw malformed();
          const start = j;
          while (j < n && !isXmlSpace(text.charCodeAt(j)) && text[j] !== ">") j++;
          raw = text.slice(start, j);
        }
      }
      const colon = attrName.indexOf(":");
      attrs.push({
        qname: attrName,
        prefix: colon < 0 ? "" : attrName.slice(0, colon),
        local: colon < 0 ? attrName : attrName.slice(colon + 1),
        value: decodeEntities(raw, label, lenient),
      });
    }
    onStart(qname, attrs, selfClosing);
    if (!selfClosing) {
      stack.push(qname);
      if (lenient && stack.length > 1024) throw malformed(); // bounds the lastIndexOf above
    }
    i = j;
  }
  if (stack.length && !lenient) throw malformed();
}
