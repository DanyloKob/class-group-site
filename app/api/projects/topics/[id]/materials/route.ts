import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { requireAuthApi } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/server/audit";
import { enqueueConversion, ensureQueueStarted } from "@/lib/server/conversionQueue";
import { getMaterialsBaseDir, materialDir, originalPath, stagingDir } from "@/lib/server/materialStorage";
import { newMaterialToken } from "@/lib/server/projects";

type Sidecar = { userId: string; kind: "PDF" | "PPTX"; size: number; fileName: string; createdAt: number };

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthApi();
  if (auth.error) return auth.error;
  const { user } = auth;
  const { id: topicId } = await params;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "bad_request" }, { status: 400 });

  let text: string | null = null;
  if (body.text !== undefined && body.text !== null) {
    if (typeof body.text !== "string" || body.text.length > 2000) {
      return NextResponse.json({ error: "bad_text" }, { status: 400 });
    }
    text = body.text.trim() || null;
  }

  const topic = await prisma.projectTopic.findUnique({ where: { id: topicId }, select: { id: true } });
  if (!topic) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (body.kind === "LINK") {
    if (typeof body.url !== "string" || body.url.length > 2000) {
      return NextResponse.json({ error: "bad_url" }, { status: 400 });
    }
    let parsed: URL;
    try {
      parsed = new URL(body.url.trim());
    } catch {
      return NextResponse.json({ error: "bad_url" }, { status: 400 });
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json({ error: "bad_url" }, { status: 400 });
    }
    const url = parsed.toString();
    const material = await prisma.projectMaterial.create({
      data: { topicId, token: newMaterialToken(), kind: "LINK", url, text, authorId: user.id },
      select: { id: true, token: true },
    });
    await logAudit(user.id, "CREATE", "ProjectMaterial", url);
    return NextResponse.json({ material }, { status: 201 });
  }

  if (body.kind !== "FILE") return NextResponse.json({ error: "bad_kind" }, { status: 400 });

  const uploadId = body.uploadId;
  if (typeof uploadId !== "string" || !/^[a-f0-9]{32}$/.test(uploadId)) {
    return NextResponse.json({ error: "bad_upload" }, { status: 400 });
  }
  if (!getMaterialsBaseDir()) return NextResponse.json({ error: "storage_not_configured" }, { status: 503 });

  const stagedBin = path.join(/* turbopackIgnore: true */ stagingDir(), `${uploadId}.bin`);
  const stagedMeta = path.join(/* turbopackIgnore: true */ stagingDir(), `${uploadId}.json`);
  let sidecar: Sidecar;
  try {
    sidecar = JSON.parse(await fs.readFile(stagedMeta, "utf8")) as Sidecar;
    await fs.access(stagedBin);
  } catch {
    return NextResponse.json({ error: "bad_upload" }, { status: 400 });
  }
  if (sidecar.userId !== user.id || (sidecar.kind !== "PDF" && sidecar.kind !== "PPTX")) {
    return NextResponse.json({ error: "bad_upload" }, { status: 400 });
  }

  // A staged file is used once: claim it by removing the sidecar first. The
  // unlink fails for the loser of a double submit.
  try {
    await fs.unlink(stagedMeta);
  } catch {
    return NextResponse.json({ error: "bad_upload" }, { status: 400 });
  }

  const material = await prisma.projectMaterial.create({
    data: {
      topicId,
      token: newMaterialToken(),
      kind: sidecar.kind,
      text,
      fileName: sidecar.fileName,
      fileSize: sidecar.size,
      conversionStatus: sidecar.kind === "PPTX" ? "PENDING" : null,
      authorId: user.id,
    },
    select: { id: true, token: true },
  });

  try {
    await fs.mkdir(materialDir(material.id), { recursive: true });
    await fs.rename(stagedBin, originalPath(material.id, sidecar.kind));
  } catch (error) {
    console.error("[materials] could not store staged file", error);
    await prisma.projectMaterial.delete({ where: { id: material.id } }).catch(() => {});
    await fs.rm(materialDir(material.id), { recursive: true, force: true }).catch(() => {});
    await fs.unlink(stagedBin).catch(() => {});
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }

  await logAudit(user.id, "CREATE", "ProjectMaterial", sidecar.fileName);
  if (sidecar.kind === "PPTX") {
    ensureQueueStarted();
    enqueueConversion(material.id);
  }
  return NextResponse.json({ material }, { status: 201 });
}
