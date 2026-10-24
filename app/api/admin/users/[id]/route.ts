import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSuperAdminApi } from "@/lib/auth/permissions";
import { normalizePhone } from "@/lib/auth/phone";
import { serializeBigInts } from "@/lib/serialize";
import { ScheduleGroup } from "@/lib/generated/prisma/enums";

// isSuperAdmin is deliberately absent here - it's a fixed owner flag set
// outside this UI, never toggled through the member-editing endpoints.
const updateSchema = z.object({
  phone: z.string().trim().min(5).max(20).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  firstName: z.string().trim().min(1).max(100).optional(),
  canManageTasks: z.boolean().optional(),
  canManageNews: z.boolean().optional(),
  canManageSchedule: z.boolean().optional(),
  canManageDuty: z.boolean().optional(),
  canPostMemories: z.boolean().optional(),
  scheduleGroup: z.enum(ScheduleGroup).nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireSuperAdminApi();
  if (check.error) return check.error;
  const { id } = await params;

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.phone !== undefined) {
    const phone = normalizePhone(parsed.data.phone);
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing && existing.id !== id) {
      return NextResponse.json({ error: "phone_already_registered" }, { status: 409 });
    }
    data.phone = phone;
  }

  const user = await prisma.user.update({ where: { id }, data });
  return NextResponse.json({ user: serializeBigInts(user) });
}
