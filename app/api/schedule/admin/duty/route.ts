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

// GET ?month=YYYY-MM - every assignment in that month, flat. The editor
// needs the whole month at once anyway (it also counts per-person turns to
// keep the rotation fair), so this is one round trip instead of ~22.
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
  const rows = await prisma.dutyAssignment.findMany({
    where: { date: { gte: from, lt: to } },
    select: { date: true, dutyType: true, personId: true },
  });

  return NextResponse.json({
    assignments: rows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      dutyType: r.dutyType,
      personId: r.personId,
    })),
  });
}

const putSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dutyType: z.enum(DutyType),
  personIds: z.array(z.string().min(1)).max(50),
});

// PUT replaces the whole roster for one date + duty type. The editor always
// knows the full list it wants, so replace-in-a-transaction keeps client and
// server in sync with no add/remove diffing on either side.
export async function PUT(request: Request) {
  const check = await requireAuthApi();
  if (check.error) return check.error;
  if (!canManageDuty(check.user)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const parsed = putSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const { date, dutyType, personIds } = parsed.data;
  const dateValue = parseDateParam(date);
  const unique = Array.from(new Set(personIds));

  await prisma.$transaction([
    prisma.dutyAssignment.deleteMany({ where: { date: dateValue, dutyType } }),
    ...(unique.length > 0
      ? [
          prisma.dutyAssignment.createMany({
            data: unique.map((personId) => ({
              date: dateValue,
              dutyType,
              personId,
              createdById: check.user.id,
            })),
          }),
        ]
      : []),
  ]);

  return NextResponse.json({ ok: true });
}
