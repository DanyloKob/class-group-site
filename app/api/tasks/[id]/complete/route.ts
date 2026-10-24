import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

async function assertPlainTask(taskId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { type: true } });
  if (!task) return { error: NextResponse.json({ error: "not_found" }, { status: 404 }) };
  if (task.type !== "PLAIN") {
    return { error: NextResponse.json({ error: "not_a_plain_task" }, { status: 400 }) };
  }
  return { error: null };
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;

  const check = await assertPlainTask(id);
  if (check.error) return check.error;

  await prisma.taskCompletion.upsert({
    where: { taskId_userId: { taskId: id, userId: user.id } },
    create: { taskId: id, userId: user.id },
    update: {},
  });

  return NextResponse.json({ done: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;

  await prisma.taskCompletion.deleteMany({ where: { taskId: id, userId: user.id } });

  return NextResponse.json({ done: false });
}
