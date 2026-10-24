import "server-only";
import sharp, { type Metadata } from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { UPLOADS_BASE_DIR } from "@/lib/uploadsDir";

const MAX_DIMENSION = 1600;
const ALLOWED_FORMATS = new Set(["png", "jpeg"]);

export type ProcessedImage = { data: Buffer; mimeType: string; extension: "png" | "jpg"; width: number; height: number };
export type SavedImage = { url: string; mimeType: string; width: number; height: number };

/**
 * The client's <input accept> is a UX hint only - this is the actual
 * boundary. Decoding with sharp is a stronger check than a magic-byte sniff:
 * a file that merely spoofs the first few bytes still fails here because it
 * won't decode as a real image at all. Pure in-memory - callers validate
 * every file in a batch before writing any of them to disk, so one invalid
 * image in a multi-photo post never leaves earlier ones orphaned on disk.
 */
export async function processImage(buffer: Buffer): Promise<ProcessedImage | null> {
  let metadata: Metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    return null;
  }
  if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
    return null;
  }

  const pipeline = sharp(buffer)
    .rotate() // normalize EXIF orientation before it becomes meaningless post-resize
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true });

  const isPng = metadata.format === "png";
  const { data, info } = isPng
    ? await pipeline.png({ quality: 90 }).toBuffer({ resolveWithObject: true })
    : await pipeline.jpeg({ quality: 85 }).toBuffer({ resolveWithObject: true });

  return {
    data,
    mimeType: isPng ? "image/png" : "image/jpeg",
    extension: isPng ? "png" : "jpg",
    width: info.width,
    height: info.height,
  };
}

export async function saveProcessedImage(image: ProcessedImage, subdir: string): Promise<SavedImage> {
  const filename = `${randomBytes(16).toString("hex")}.${image.extension}`;
  const dir = path.join(UPLOADS_BASE_DIR, subdir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(/* turbopackIgnore: true */ dir, filename), image.data);

  return { url: `/uploads/${subdir}/${filename}`, mimeType: image.mimeType, width: image.width, height: image.height };
}
