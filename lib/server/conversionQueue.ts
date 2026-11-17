// NO "server-only" import: instrumentation.ts imports this module.
import fs from "node:fs/promises";
import { prisma } from "@/lib/db";
import { convertPptxToPdf, ensureConverterReady } from "@/lib/server/converterSandbox";
import { convertedPath, materialDir, originalPath, removeMaterialFiles } from "@/lib/server/materialStorage";
import { inspectPptx } from "@/lib/server/pptxSafety";

type QueueState = { chain: Promise<void>; queued: Set<string>; started: boolean };
const g = globalThis as unknown as { __ftlConversion?: QueueState };
const state: QueueState = (g.__ftlConversion ??= { chain: Promise.resolve(), queued: new Set(), started: false });

const MAX_ATTEMPTS = 3;

/** Fire-and-forget, deduped. One LibreOffice conversion at a time per process. */
export function enqueueConversion(materialId: string): void {
  if (state.queued.has(materialId)) return;
  state.queued.add(materialId);
  state.chain = state.chain
    .then(() => runOne(materialId))
    .catch((error) => console.error("[convert] failed", materialId, error))
    .finally(() => {
      state.queued.delete(materialId);
    });
}

export async function requeuePendingConversions(): Promise<number> {
  const rows = await prisma.projectMaterial.findMany({
    where: { kind: "PPTX", conversionStatus: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  for (const row of rows) enqueueConversion(row.id);
  console.log(`[convert] requeued ${rows.length} pending`);
  return rows.length;
}

/** Idempotent: requeues PENDING rows once per process (instrumentation plus route fallbacks). */
export function ensureQueueStarted(): void {
  if (state.started) return;
  state.started = true;
  // Logs the sandbox status (or a loud error) at boot instead of at the first upload.
  void ensureConverterReady().catch((error) => console.error("[convert] sandbox check failed", error));
  void requeuePendingConversions().catch((error) => {
    state.started = false;
    console.error("[convert] requeue failed", error);
  });
}

async function setFailed(id: string, error: string) {
  await prisma.projectMaterial.updateMany({
    where: { id },
    data: { conversionStatus: "FAILED", conversionError: error },
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

async function runOne(id: string): Promise<void> {
  const row = await prisma.projectMaterial.findUnique({ where: { id } });
  if (!row || row.kind !== "PPTX" || row.conversionStatus !== "PENDING") return;

  if (row.conversionAttempts >= MAX_ATTEMPTS) {
    await setFailed(id, "too_many_attempts");
    return;
  }
  const claim = await prisma.projectMaterial.updateMany({
    where: { id, conversionStatus: "PENDING", conversionAttempts: row.conversionAttempts },
    data: { conversionAttempts: { increment: 1 } },
  });
  if (claim.count === 0) return;

  const original = originalPath(id, "PPTX");
  if (!(await exists(original))) {
    await setFailed(id, "missing_original");
    return;
  }

  // Layer 1: refuse packages that could make LibreOffice fetch files or URLs (pptxSafety.ts).
  // Layers 2 and 3 (bubblewrap sandbox, minimal env) live in converterSandbox.ts.
  let error: string | null = null;
  const verdict = await inspectPptx(original);
  if (!verdict.ok) {
    error = `unsafe_pptx:${verdict.reason}`;
    console.warn(`[convert] refused ${id}: ${verdict.reason}${verdict.part ? ` in ${JSON.stringify(verdict.part.slice(0, 200))}` : ""}`);
  } else {
    try {
      const result = await convertPptxToPdf(original, { workDir: materialDir(id), destPdf: convertedPath(id) });
      if (!result.ok) error = result.error;
    } catch (caught) {
      console.error("[convert] unexpected error", id, caught);
      error = "internal_error";
    }
  }

  const after = await prisma.projectMaterial.findUnique({ where: { id }, select: { id: true } });
  if (!after) {
    await removeMaterialFiles(id);
    return;
  }
  if (error) {
    console.error("[convert] failed", id, error);
    await setFailed(id, error);
  } else {
    await prisma.projectMaterial.update({
      where: { id },
      data: { conversionStatus: "READY", convertedAt: new Date(), conversionError: null },
    });
  }
}
