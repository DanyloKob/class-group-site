import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isDevLoginEnabled } from "@/lib/auth/dev-login";

export async function GET() {
  if (!isDevLoginEnabled()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      isSuperAdmin: true,
      canManageTasks: true,
      canManageNews: true,
      canManageSchedule: true,
      canManageDuty: true,
      canPostMemories: true,
    },
    orderBy: [{ isSuperAdmin: "desc" }, { lastName: "asc" }],
  });

  return NextResponse.json({ users });
}
