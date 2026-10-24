import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { canEditHomework, canDeleteHomework } from "@/lib/schedule/permissions";
import { logAudit } from "@/lib/server/audit";

const updateSchema = z.object({ text: z.string().trim().min(1).max(2000) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;

  const homework = await prisma.homework.findUnique({ where: { id } });
  if (!homework) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // Edit is always self-only, even for admins/starosta.
  if (!canEditHomework(user, homework)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }

  const updated = await prisma.homework.update({ where: { id }, data: { text: parsed.data.text } });
  return NextResponse.json({ homework: updated });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;

  const homework = await prisma.homework.findUnique({
    where: { id },
    include: { author: { select: { firstName: true, lastName: true } } },
  });
  if (!homework) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!canDeleteHomework(user, homework)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await prisma.homework.delete({ where: { id } });
  const summary =
    homework.authorId === user.id
      ? homework.text
      : `${homework.text} (автор: ${homework.author.firstName} ${homework.author.lastName})`;
  await logAudit(user.id, "DELETE", "Homework", summary);
  return NextResponse.json({ ok: true });
}
