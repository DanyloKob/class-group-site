import fs from "node:fs";
import fsp from "node:fs/promises";
import { Readable } from "node:stream";
import { prisma } from "@/lib/db";
import { contentDisposition } from "@/lib/server/fileSniff";
import { convertedPath, getMaterialsBaseDir, originalPath } from "@/lib/server/materialStorage";
import { isValidMaterialToken } from "@/lib/server/projects";

export const dynamic = "force-dynamic";

const PDF_TYPE = "application/pdf";
const PPTX_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const notFound = () =>
  new Response(null, { status: 404, headers: { "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" } });

/** One range only. Returns null for "no usable range header" (serve the full file) or "unsatisfiable". */
function parseRange(header: string | null, size: number): { start: number; end: number } | "unsatisfiable" | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null; // multi-range or garbage: ignore and send everything
  const [, a, b] = match;
  if (a === "" && b === "") return null;
  let start: number;
  let end: number;
  if (a === "") {
    const suffix = Number(b);
    if (suffix === 0) return "unsatisfiable";
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(a);
    end = b === "" ? size - 1 : Math.min(Number(b), size - 1);
  }
  if (start >= size || start > end) return "unsatisfiable";
  return { start, end };
}

async function serve(request: Request, params: Promise<{ token: string; file: string }>, withBody: boolean) {
  const { token, file } = await params;
  if (!isValidMaterialToken(token)) return notFound();
  if (file !== "original.pdf" && file !== "original.pptx" && file !== "slides.pdf") return notFound();
  if (!getMaterialsBaseDir()) return notFound();

  const material = await prisma.projectMaterial.findUnique({
    where: { token },
    select: { id: true, kind: true, fileName: true, conversionStatus: true },
  });
  if (!material) return notFound();

  let diskPath: string;
  let contentType: string;
  let name: string;
  let forceAttachment = false;
  const baseName = material.fileName ?? "file";
  if (file === "original.pdf" && material.kind === "PDF") {
    diskPath = originalPath(material.id, "PDF");
    contentType = PDF_TYPE;
    name = baseName;
  } else if (file === "original.pptx" && material.kind === "PPTX") {
    diskPath = originalPath(material.id, "PPTX");
    contentType = PPTX_TYPE;
    name = baseName;
    forceAttachment = true;
  } else if (file === "slides.pdf" && material.kind === "PPTX" && material.conversionStatus === "READY") {
    diskPath = convertedPath(material.id);
    contentType = PDF_TYPE;
    name = baseName.replace(/\.pptx$/i, "") + ".pdf";
  } else {
    return notFound();
  }

  let size: number;
  try {
    size = (await fsp.stat(diskPath)).size;
  } catch {
    return notFound();
  }

  const download = new URL(request.url).searchParams.get("download") === "1";
  const headers = new Headers({
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "sandbox; default-src 'none'; frame-ancestors 'none'",
    "Content-Disposition": contentDisposition(download || forceAttachment ? "attachment" : "inline", name),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=86400",
    "Referrer-Policy": "no-referrer",
  });

  const range = parseRange(request.headers.get("range"), size);
  if (range === "unsatisfiable") {
    headers.set("Content-Range", `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }

  const start = range ? range.start : 0;
  const end = range ? range.end : size - 1;
  const length = size === 0 ? 0 : end - start + 1;
  headers.set("Content-Length", String(length));
  if (range) headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  const status = range ? 206 : 200;

  if (!withBody || length === 0) return new Response(null, { status, headers });

  const stream = fs.createReadStream(diskPath, { start, end });
  return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, { status, headers });
}

export async function GET(request: Request, { params }: { params: Promise<{ token: string; file: string }> }) {
  return serve(request, params, true);
}

export async function HEAD(request: Request, { params }: { params: Promise<{ token: string; file: string }> }) {
  return serve(request, params, false);
}
