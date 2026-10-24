import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { requireAuthApi } from "@/lib/auth/permissions";
import { canManageTasks } from "@/lib/permissions";
import { getTaskDetail } from "@/lib/server/tasks";
import { logAudit } from "@/lib/server/audit";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;

  const task = await getTaskDetail(id, user.id);
  if (!task) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ task, canManage: canManageTasks(user) });
}

// type is immutable post-creation (mismatched completion/entry rows would
// orphan) - the fix path for a wrong type is delete + recreate.
const updateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  archivedAt: z.string().datetime().nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAuthApi();
  if (check.error) return check.error;
  if (!canManageTasks(check.user)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...(parsed.data.title !== undefined && { title: parsed.data.title }),
      ...(parsed.data.description !== undefined && { description: parsed.data.description }),
      ...(parsed.data.dueDate !== undefined && {
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      }),
      ...(parsed.data.archivedAt !== undefined && {
        archivedAt: parsed.data.archivedAt ? new Date(parsed.data.archivedAt) : null,
      }),
    },
  });

  return NextResponse.json({ task });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAuthApi();
  if (check.error) return check.error;
  if (!canManageTasks(check.user)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const task = await prisma.task.delete({ where: { id } });
  await logAudit(check.user.id, "DELETE", "Task", task.title);
  return NextResponse.json({ ok: true });
}
