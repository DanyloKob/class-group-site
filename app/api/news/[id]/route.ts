import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuthApi } from "@/lib/auth/permissions";
import { canManageNews } from "@/lib/permissions";
import { logAudit } from "@/lib/server/audit";

const updateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  body: z.string().trim().min(1).max(4000).optional(),
  eventAt: z.string().datetime().nullable().optional(),
  isPinned: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAuthApi();
  if (check.error) return check.error;
  if (!canManageNews(check.user)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }

  const post = await prisma.newsPost.update({
    where: { id },
    data: {
      ...(parsed.data.title !== undefined && { title: parsed.data.title }),
      ...(parsed.data.body !== undefined && { body: parsed.data.body }),
      ...(parsed.data.eventAt !== undefined && {
        eventAt: parsed.data.eventAt ? new Date(parsed.data.eventAt) : null,
      }),
      ...(parsed.data.isPinned !== undefined && { isPinned: parsed.data.isPinned }),
    },
  });

  return NextResponse.json({ post });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAuthApi();
  if (check.error) return check.error;
  if (!canManageNews(check.user)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const post = await prisma.newsPost.delete({ where: { id } });
  await logAudit(check.user.id, "DELETE", "News", post.title);
  return NextResponse.json({ ok: true });
}
