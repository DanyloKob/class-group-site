import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuthApi } from "@/lib/auth/permissions";
import { canManageScheduleSettings } from "@/lib/permissions";
import { ClassGroupScope } from "@/lib/generated/prisma/enums";
import { parseDateParam } from "@/lib/schedule/parity";

export async function GET(request: Request) {
  const check = await requireAuthApi();
  if (check.error) return check.error;
  if (!canManageScheduleSettings(check.user)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const dateParam = new URL(request.url).searchParams.get("date");
  if (!dateParam) return NextResponse.json({ error: "date_required" }, { status: 400 });

  const overrides = await prisma.classOverride.findMany({ where: { date: parseDateParam(dateParam) } });
  return NextResponse.json({ overrides });
}

const putSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: z.number().int().min(1).max(4),
  scope: z.enum(ClassGroupScope),
  isCancelled: z.boolean().default(false),
  subject: z.string().trim().max(100).nullable().optional(),
  teacher: z.string().trim().max(100).nullable().optional(),
  room: z.string().trim().max(50).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

export async function PUT(request: Request) {
  const check = await requireAuthApi();
  if (check.error) return check.error;
  if (!canManageScheduleSettings(check.user)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const parsed = putSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const { date, slot, scope, ...fields } = parsed.data;
  const dateValue = parseDateParam(date);

  const override = await prisma.classOverride.upsert({
    where: { date_slot_scope: { date: dateValue, slot, scope } },
    create: { date: dateValue, slot, scope, ...fields, createdById: check.user.id },
    update: { ...fields },
  });

  return NextResponse.json({ override });
}

export async function DELETE(request: Request) {
  const check = await requireAuthApi();
  if (check.error) return check.error;
  if (!canManageScheduleSettings(check.user)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });

  await prisma.classOverride.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
