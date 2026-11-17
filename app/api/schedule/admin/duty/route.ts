import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuthApi } from "@/lib/auth/permissions";
import { canManageDuty } from "@/lib/permissions";
import { DutyType } from "@/lib/generated/prisma/enums";
import { parseDateParam } from "@/lib/schedule/parity";

/** First day of `month` ("YYYY-MM") and of the month after it, as UTC dates. */
function monthBounds(month: string): { from: Date; to: Date } {
  const [y, m] = month.split("-").map(Number);
  return { from: new Date(Date.UTC(y, m - 1, 1)), to: new Date(Date.UTC(y, m, 1)) };
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

// GET ?month=YYYY-MM - every assignment in that month, flat, plus how many
// turns each person has in every OTHER month. The editor needs the whole
// month at once anyway, and the per-person counter is all-time (every month
// in the DB, past and future), so the month's own rows are counted client
// side - that keeps the numbers live while ticking - and everything outside
// the month arrives here as a ready-made tally.
export async function GET(request: Request) {
  const check = await requireAuthApi();
  if (check.error) return check.error;
  if (!canManageDuty(check.user)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const month = new URL(request.url).searchParams.get("month");
  if (!month || !MONTH_PATTERN.test(month)) {
    return NextResponse.json({ error: "month_required" }, { status: 400 });
  }

  const { from, to } = monthBounds(month);
  const [rows, outside] = await Promise.all([
    prisma.dutyAssignment.findMany({
      where: { date: { gte: from, lt: to } },
      select: { date: true, dutyType: true, personId: true, createdById: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.dutyAssignment.groupBy({
      by: ["personId", "dutyType"],
      where: { OR: [{ date: { lt: from } }, { date: { gte: to } }] },
      _count: { _all: true },
    }),
  ]);

  return NextResponse.json({
    month,
    assignments: rows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      dutyType: r.dutyType,
      personId: r.personId,
      createdById: r.createdById,
    })),
    countsOutsideMonth: outside.map((r) => ({
      personId: r.personId,
      dutyType: r.dutyType,
      count: r._count._all,
    })),
  });
}

const patchSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dutyType: z.enum(DutyType),
    add: z.array(z.string().min(1)).max(50).default([]),
    remove: z.array(z.string().min(1)).max(50).default([]),
  })
  .refine((v) => v.add.length + v.remove.length > 0, { message: "nothing_to_do" })
  .refine((v) => !v.add.some((id) => v.remove.includes(id)), { message: "id_in_both" });

// PATCH adds and/or removes individual people on one date + duty type. It
// replaced a whole-roster PUT: with several editors, a PUT from a stale screen
// silently erased names another editor had just added. Per-person add and
// remove commute, and repeating either is harmless. The answer is the
// authoritative cell, so the caller immediately sees what others put there.
export async function PATCH(request: Request) {
  const check = await requireAuthApi();
  if (check.error) return check.error;
  if (!canManageDuty(check.user)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const { date, dutyType } = parsed.data;
  const add = Array.from(new Set(parsed.data.add));
  const remove = Array.from(new Set(parsed.data.remove));
  const dateValue = parseDateParam(date);

  if (add.length > 0) {
    const known = await prisma.user.count({ where: { id: { in: add } } });
    if (known !== add.length) {
      return NextResponse.json({ error: "unknown_person" }, { status: 400 });
    }
  }

  await prisma.$transaction([
    ...(remove.length > 0
      ? [prisma.dutyAssignment.deleteMany({ where: { date: dateValue, dutyType, personId: { in: remove } } })]
      : []),
    ...(add.length > 0
      ? [
          prisma.dutyAssignment.createMany({
            data: add.map((personId) => ({ date: dateValue, dutyType, personId, createdById: check.user.id })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);

  const people = await prisma.dutyAssignment.findMany({
    where: { date: dateValue, dutyType },
    select: { personId: true, createdById: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ date, dutyType, people });
}
