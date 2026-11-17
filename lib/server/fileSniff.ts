import "server-only";
import fs from "node:fs/promises";

const MAX_CD_BYTES = 8 * 1024 * 1024;
const MAX_ENTRIES = 20_000;

/** Detects the real type from magic bytes (never from the name or the client's MIME). */
export async function sniffUpload(filePath: string): Promise<"PDF" | "PPTX" | null> {
  let handle: fs.FileHandle | undefined;
  try {
    handle = await fs.open(filePath, "r");
    const { size } = await handle.stat();
    if (size < 5) return null;

    const head = Buffer.alloc(5);
    await handle.read(head, 0, 5, 0);
    if (head.toString("latin1") === "%PDF-") return "PDF";
    if (head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04) {
      return (await zipHasPptxEntries(handle, size)) ? "PPTX" : null;
    }
    return null;
  } catch {
    return null;
  } finally {
    await handle?.close().catch(() => {});
  }
}

async function zipHasPptxEntries(handle: fs.FileHandle, size: number): Promise<boolean> {
  const tailLen = Math.min(size, 65_557);
  const tail = Buffer.alloc(tailLen);
  await handle.read(tail, 0, tailLen, size - tailLen);

  let eocd = -1;
  for (let i = tailLen - 22; i >= 0; i--) {
    if (tail.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return false;

  const entryCount = tail.readUInt16LE(eocd + 10);
  const cdSize = tail.readUInt32LE(eocd + 12);
  const cdOffset = tail.readUInt32LE(eocd + 16);
  if (cdSize === 0xffffffff || cdOffset === 0xffffffff || entryCount === 0xffff) return false; // ZIP64
  if (cdSize > MAX_CD_BYTES || cdOffset + cdSize > size) return false;

  const cd = Buffer.alloc(cdSize);
  await handle.read(cd, 0, cdSize, cdOffset);

  let hasContentTypes = false;
  let hasPresentation = false;
  let pos = 0;
  for (let n = 0; n < Math.min(entryCount, MAX_ENTRIES); n++) {
    if (pos + 46 > cdSize || cd.readUInt32LE(pos) !== 0x02014b50) break;
    const nameLen = cd.readUInt16LE(pos + 28);
    const extraLen = cd.readUInt16LE(pos + 30);
    const commentLen = cd.readUInt16LE(pos + 32);
    if (pos + 46 + nameLen > cdSize) break;
    const name = cd.toString("utf8", pos + 46, pos + 46 + nameLen);
    if (name === "[Content_Types].xml") hasContentTypes = true;
    if (name === "ppt/presentation.xml") hasPresentation = true;
    if (hasContentTypes && hasPresentation) return true;
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return hasContentTypes && hasPresentation;
}

/** Strips directories, control chars and /\:*?"<>|, collapses whitespace, max 120 chars keeping the extension. */
export function sanitizeFileName(raw: string): string {
  let name = raw.normalize("NFC");
  name = name.split(/[\\/]/).pop() ?? "";
  name = name.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, "");
  name = name.replace(/[:*?"<>|]/g, "");
  name = name.replace(/\s+/g, " ").trim();
  name = name.replace(/^\.+/, "");
  if (name.length > 120) {
    const dot = name.lastIndexOf(".");
    const ext = dot > 0 && name.length - dot <= 10 ? name.slice(dot) : "";
    name = name.slice(0, 120 - ext.length).trimEnd() + ext;
  }
  return name;
}

/** `inline|attachment; filename="<ascii fallback>"; filename*=UTF-8''<percent-encoded>` */
export function contentDisposition(type: "inline" | "attachment", fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "");
  const encoded = encodeURIComponent(fileName).replace(/['()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
