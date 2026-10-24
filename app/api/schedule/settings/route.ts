import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { requireAuthApi } from "@/lib/auth/permissions";
import { canManageScheduleSettings } from "@/lib/permissions";
import { WeekParity } from "@/lib/generated/prisma/enums";
import { getScheduleSettings } from "@/lib/server/schedule";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const settings = await getScheduleSettings();
  return NextResponse.json({ settings, canManage: canManageScheduleSettings(user) });
}

const putSchema = z.object({
  parityAnchorDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  parityAnchorType: z.enum(WeekParity),
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

  const settings = await prisma.scheduleSettings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      parityAnchorDate: new Date(parsed.data.parityAnchorDate),
      parityAnchorType: parsed.data.parityAnchorType,
      updatedById: check.user.id,
    },
    update: {
      parityAnchorDate: new Date(parsed.data.parityAnchorDate),
      parityAnchorType: parsed.data.parityAnchorType,
      updatedById: check.user.id,
    },
  });

  return NextResponse.json({ settings });
}
