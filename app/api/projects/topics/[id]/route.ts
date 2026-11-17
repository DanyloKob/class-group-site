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

  const result = await prisma.$transaction(async (tx) => {
    const topic = await tx.projectTopic.findUnique({
      where: { id },
      include: {
        materials: { select: { id: true, authorId: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
    });
    if (!topic) return { status: 404 as const };

    const isAuthor = topic.createdById === user.id;
    if (!isAuthor && !user.isSuperAdmin) return { status: 403 as const };
    if (!user.isSuperAdmin && topic.materials.some((m) => m.authorId !== user.id)) {
      return { status: 409 as const };
    }

    await tx.projectTopic.delete({ where: { id } });
    return { status: 200 as const, topic };
  });

  if (result.status === 404) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (result.status === 403) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (result.status === 409) return NextResponse.json({ error: "has_others_materials" }, { status: 409 });

  const { topic } = result;
  // Cascade removed only the rows; the files on disk go after the commit.
  await Promise.all(topic.materials.map((m) => removeMaterialFiles(m.id).catch(() => {})));

  const summary =
    topic.createdById === user.id
      ? topic.title
      : `${topic.title} (автор: ${topic.createdBy.firstName} ${topic.createdBy.lastName})`;
  await logAudit(user.id, "DELETE", "ProjectTopic", summary);
  return NextResponse.json({ ok: true });
}
