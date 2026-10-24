import { NextResponse } from "next/server";
import { requireAuthApi } from "@/lib/auth/permissions";
import { canManageTasks } from "@/lib/permissions";
import { getFundraiserRoster } from "@/lib/server/tasks";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAuthApi();
  if (check.error) return check.error;
  if (!canManageTasks(check.user)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const roster = await getFundraiserRoster(id);
  return NextResponse.json({ roster });
}
