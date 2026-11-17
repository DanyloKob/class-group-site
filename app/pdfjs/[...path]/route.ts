import { readFile } from "node:fs/promises";
import path from "node:path";

const ALLOWED_SUBDIRS = new Set(["standard_fonts", "cmaps", "wasm", "iccs"]);
const CONTENT_TYPES: Record<string, string> = {
  ".pfb": "application/octet-stream",
  ".ttf": "font/ttf",
  ".bcmap": "application/octet-stream",
  ".icc": "application/octet-stream",
  ".wasm": "application/wasm",
  ".js": "text/javascript; charset=utf-8",
};

/**
 * Static pdf.js assets (fonts, cMaps, wasm decoders, ICC profiles) read from
 * node_modules/pdfjs-dist. Only four sub-folders and a fixed extension list
 * are reachable, and the resolved path must stay inside the chosen sub-folder.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const [sub, ...rest] = segments;
  if (!sub || !ALLOWED_SUBDIRS.has(sub) || rest.length === 0) {
    return new Response(null, { status: 404 });
  }

  const baseDir = path.resolve(/* turbopackIgnore: true */ process.cwd(), "node_modules", "pdfjs-dist", sub);
  const filePath = path.resolve(/* turbopackIgnore: true */ baseDir, ...rest);
  const contentType = CONTENT_TYPES[path.extname(filePath).toLowerCase()];

  if (!contentType || !filePath.startsWith(baseDir + path.sep)) {
    return new Response(null, { status: 404 });
  }

  let data: Buffer;
  try {
    data = await readFile(filePath);
  } catch {
    return new Response(null, { status: 404 });
  }

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(data.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
