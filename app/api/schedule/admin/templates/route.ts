import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuthApi } from "@/lib/auth/permissions";
import { canManageScheduleSettings } from "@/lib/permissions";
import { Weekday, WeekParity } from "@/lib/generated/prisma/enums";

export async function GET(request: Request) {
  const check = await requireAuthApi();
  if (check.error) return check.error;
  if (!canManageScheduleSettings(check.user)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const weekday = url.searchParams.get("weekday");
  const parity = url.searchParams.get("parity");

  const templates = await prisma.classTemplate.findMany({
    where: {
      ...(weekday && { weekday: weekday as Weekday }),
      ...(parity && { parity: parity as WeekParity }),
    },
    orderBy: [{ weekday: "asc" }, { slot: "asc" }],
  });

  return NextResponse.json({ templates });
}

const classFields = z.object({
  subject: z.string().trim().min(1).max(100),
  teacher: z.string().trim().min(1).max(100),
  room: z.string().trim().min(1).max(50),
});

// mode discriminates whether this slot is one SHARED row or up to two
// per-group rows - the endpoint deletes the other mode's rows on save so
// the admin never has to reason about stale leftovers.
const putSchema = z.object({
  weekday: z.enum(Weekday),
  parity: z.enum(WeekParity),
  slot: z.number().int().min(1).max(4),
  mode: z.enum(["SHARED", "SPLIT"]),
  shared: classFields.nullable().optional(),
  groupA: classFields.nullable().optional(),
  groupB: classFields.nullable().optional(),
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
  const { weekday, parity, slot, mode } = parsed.data;

  await prisma.$transaction(async (tx) => {
    if (mode === "SHARED") {
      await tx.classTemplate.deleteMany({ where: { weekday, parity, slot, scope: { in: ["A", "B"] } } });
      if (parsed.data.shared) {
        await tx.classTemplate.upsert({
          where: { weekday_parity_slot_scope: { weekday, parity, slot, scope: "SHARED" } },
          create: { weekday, parity, slot, scope: "SHARED", ...parsed.data.shared, createdById: check.user.id },
          update: { ...parsed.data.shared },
        });
      } else {
        await tx.classTemplate.deleteMany({ where: { weekday, parity, slot, scope: "SHARED" } });
      }
    } else {
      await tx.classTemplate.deleteMany({ where: { weekday, parity, slot, scope: "SHARED" } });
      for (const [scope, fields] of [
        ["A", parsed.data.groupA],
        ["B", parsed.data.groupB],
      ] as const) {
        if (fields) {
          await tx.classTemplate.upsert({
            where: { weekday_parity_slot_scope: { weekday, parity, slot, scope } },
            create: { weekday, parity, slot, scope, ...fields, createdById: check.user.id },
            update: { ...fields },
          });
        } else {
          await tx.classTemplate.deleteMany({ where: { weekday, parity, slot, scope } });
        }
      }
    }
  });

  return NextResponse.json({ ok: true });
}
