// NO "server-only" import: instrumentation.ts (via conversionQueue) imports this,
// and instrumentation is not compiled under the react-server condition.
import fs from "node:fs/promises";
import path from "node:path";

export const MATERIAL_MAX_BYTES = 80 * 1024 * 1024;

let warnedNoBase = false;

// Every path below is runtime data, never a build input: the turbopackIgnore
// hints keep Next's standalone trace from copying the whole repo (including
// storage/ with users' uploads) into .next/standalone.

/**
 * Where «Проєкти» files live. Production REQUIRES MATERIALS_DIR (absolute, outside
 * public/, outside .next/standalone and NOT inside UPLOADS_DIR, because /uploads
 * may be served straight from disk and material ids are not secrets). In dev it
 * defaults to <repo>/storage/materials. Returns null when it is not configured.
 */
export function getMaterialsBaseDir(): string | null {
  const fromEnv = process.env.MATERIALS_DIR;
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    if (!warnedNoBase) {
      warnedNoBase = true;
      console.error("[materials] MATERIALS_DIR is not set: uploads are disabled");
    }
    return null;
  }
  return path.join(/* turbopackIgnore: true */ process.cwd(), "storage", "materials");
}

function requireBase(): string {
  const base = getMaterialsBaseDir();
  if (!base) throw new Error("MATERIALS_DIR is not configured");
  return base;
}

export function materialDir(materialId: string): string {
  return path.join(/* turbopackIgnore: true */ requireBase(), materialId);
}

export function originalPath(materialId: string, kind: "PDF" | "PPTX"): string {
  return path.join(/* turbopackIgnore: true */ materialDir(materialId), kind === "PDF" ? "original.pdf" : "original.pptx");
}

export function convertedPath(materialId: string): string {
  return path.join(/* turbopackIgnore: true */ materialDir(materialId), "slides.pdf");
}

export function stagingDir(): string {
  return path.join(/* turbopackIgnore: true */ requireBase(), ".staging");
}

export async function removeMaterialFiles(materialId: string): Promise<void> {
  // Ids are cuids from our own DB, but never let a stray separator escape the base.
  if (!/^[A-Za-z0-9_-]+$/.test(materialId)) return;
  await fs.rm(materialDir(materialId), { recursive: true, force: true });
}
