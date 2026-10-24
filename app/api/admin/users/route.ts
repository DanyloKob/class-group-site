import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSuperAdminApi } from "@/lib/auth/permissions";
import { normalizePhone } from "@/lib/auth/phone";
import { serializeBigInts } from "@/lib/serialize";
import { ScheduleGroup } from "@/lib/generated/prisma/enums";

export async function GET() {
  // Registering people and setting their permissions is superadmin-only,
  // per the client's own registration flow ("I register everyone").
  const check = await requireSuperAdminApi();
  if (check.error) return check.error;

  const users = await prisma.user.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return NextResponse.json({ users: serializeBigInts(users) });
}

// isSuperAdmin is deliberately absent here - it's a fixed owner flag set
// outside this UI, never toggled through the member-editing endpoints.
const createSchema = z.object({
  phone: z.string().trim().min(5).max(20),
  lastName: z.string().trim().min(1).max(100),
  firstName: z.string().trim().min(1).max(100),
  canManageTasks: z.boolean().default(false),
  canManageNews: z.boolean().default(false),
  canManageSchedule: z.boolean().default(false),
  canManageDuty: z.boolean().default(false),
  canPostMemories: z.boolean().default(false),
  scheduleGroup: z.enum(ScheduleGroup).nullable().default(null),
});

export async function POST(request: Request) {
  const check = await requireSuperAdminApi();
  if (check.error) return check.error;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }

  const phone = normalizePhone(parsed.data.phone);

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    return NextResponse.json({ error: "phone_already_registered" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      phone,
      lastName: parsed.data.lastName,
      firstName: parsed.data.firstName,
      canManageTasks: parsed.data.canManageTasks,
      canManageNews: parsed.data.canManageNews,
      canManageSchedule: parsed.data.canManageSchedule,
      canManageDuty: parsed.data.canManageDuty,
      canPostMemories: parsed.data.canPostMemories,
      scheduleGroup: parsed.data.scheduleGroup,
    },
  });

  return NextResponse.json({ user: serializeBigInts(user) }, { status: 201 });
}
