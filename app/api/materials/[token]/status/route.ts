import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureQueueStarted } from "@/lib/server/conversionQueue";
import { isValidMaterialToken } from "@/lib/server/projects";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const headers = { "Cache-Control": "no-store" };
  if (!isValidMaterialToken(token)) return NextResponse.json({ error: "not_found" }, { status: 404, headers });

  const material = await prisma.projectMaterial.findUnique({
    where: { token },
    select: { conversionStatus: true },
  });
  if (!material) return NextResponse.json({ error: "not_found" }, { status: 404, headers });

  // Fallback in case instrumentation did not run (idempotent, once per process).
  ensureQueueStarted();
  return NextResponse.json({ conversionStatus: material.conversionStatus }, { headers });
}
