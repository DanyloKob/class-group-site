import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuthApi } from "@/lib/auth/permissions";
import { canManageTasks } from "@/lib/permissions";

// UNPAID is intentionally not an accepted value here - DELETE reverts to the
// computed UNPAID state, keeping "no row = unpaid" the one source of truth.
const putSchema = z
  .object({
    status: z.enum(["PAID", "PAID_WITH_NOTE"]),
    note: z.string().trim().max(500).nullable().optional(),
  })
  .refine((data) => (data.status === "PAID_WITH_NOTE" ? Boolean(data.note?.trim()) : true), {
    message: "note is required for PAID_WITH_NOTE",
    path: ["note"],
  });

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const check = await requireAuthApi();
  if (check.error) return check.error;
  if (!canManageTasks(check.user)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id, userId } = await params;
  const parsed = putSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }

  const task = await prisma.task.findUnique({ where: { id }, select: { type: true } });
  if (!task) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (task.type !== "FUNDRAISER") {
    return NextResponse.json({ error: "not_a_fundraiser_task" }, { status: 400 });
  }

  const note = parsed.data.status === "PAID_WITH_NOTE" ? parsed.data.note!.trim() : null;

  const entry = await prisma.fundraiserEntry.upsert({
    where: { taskId_userId: { taskId: id, userId } },
    create: { taskId: id, userId, status: parsed.data.status, note, recordedById: check.user.id },
    update: { status: parsed.data.status, note, recordedById: check.user.id },
  });

  return NextResponse.json({ entry });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const check = await requireAuthApi();
  if (check.error) return check.error;
  if (!canManageTasks(check.user)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id, userId } = await params;
  await prisma.fundraiserEntry.deleteMany({ where: { taskId: id, userId } });

  return NextResponse.json({ status: "UNPAID" });
}
