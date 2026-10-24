import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { requireAuthApi } from "@/lib/auth/permissions";
import { canManageTasks } from "@/lib/permissions";
import { TaskType } from "@/lib/generated/prisma/client";
import { getTaskFeed } from "@/lib/server/tasks";
import { logAudit } from "@/lib/server/audit";
import { sendPushToCategory } from "@/lib/server/push";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const tasks = await getTaskFeed(user);
  return NextResponse.json({ tasks, canCreate: canManageTasks(user) });
}

const createSchema = z.object({
  type: z.enum(TaskType),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export async function POST(request: Request) {
  const check = await requireAuthApi();
  if (check.error) return check.error;
  if (!canManageTasks(check.user)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }

  const task = await prisma.task.create({
    data: {
      type: parsed.data.type,
      title: parsed.data.title,
      description: parsed.data.description || null,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      createdById: check.user.id,
    },
  });
  await logAudit(check.user.id, "CREATE", "Task", task.title);
  sendPushToCategory(
    "notifyTasks",
    { title: task.type === "FUNDRAISER" ? "Новий збір" : "Нове нагадування", body: task.title, url: `/tasks/${task.id}` },
    check.user.id,
  ).catch(() => {});

  return NextResponse.json({ task }, { status: 201 });
}
