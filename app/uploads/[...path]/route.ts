import { readFile } from "node:fs/promises";
import path from "node:path";
import { UPLOADS_BASE_DIR } from "@/lib/uploadsDir";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

/**
 * In production UPLOADS_DIR lives outside .next/standalone (see uploadsDir.ts),
 * so the standalone server's own public/ never sees these files and every
 * /uploads/* URL used to 404 - which also made next/image answer 400 for
 * them. This serves them straight from UPLOADS_BASE_DIR instead. Filenames
 * are random server-written hex (lib/uploads.ts), never user input, so the
 * same no-auth exposure public/ had before is kept.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const filePath = path.resolve(/* turbopackIgnore: true */ UPLOADS_BASE_DIR, ...segments);
  const contentType = CONTENT_TYPES[path.extname(filePath).toLowerCase()];

  // resolve() collapses any "..", so a prefix check is enough to stay inside the uploads dir.
  if (!contentType || !filePath.startsWith(path.resolve(UPLOADS_BASE_DIR) + path.sep)) {
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
      // Memory photos never change under the same random name. Avatars do keep
      // a fixed name, but every avatar URL carries a "?v=" cache-buster.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
