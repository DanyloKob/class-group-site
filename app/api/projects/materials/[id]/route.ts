import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuthApi } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/server/audit";
import { removeMaterialFiles } from "@/lib/server/materialStorage";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthApi();
  if (auth.error) return auth.error;
  const { user } = auth;
  const { id } = await params;

  const material = await prisma.projectMaterial.findUnique({
    where: { id },
    include: { author: { select: { firstName: true, lastName: true } } },
  });
  if (!material) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const isOwn = material.authorId === user.id;
  if (!isOwn && !user.isSuperAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  await prisma.projectMaterial.delete({ where: { id } });
  await removeMaterialFiles(id).catch(() => {});

  const label = material.fileName || material.url || material.text || "Матеріал";
  const summary = isOwn ? label : `${label} (автор: ${material.author.firstName} ${material.author.lastName})`;
  await logAudit(user.id, "DELETE", "ProjectMaterial", summary);
  return NextResponse.json({ ok: true });
}
