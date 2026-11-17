import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getDaySchedule } from "@/lib/server/schedule";
import { defaultScheduleDate } from "@/lib/schedule/parity";
import { canOpenScheduleAdmin } from "@/lib/schedule/permissions";

export async function GET(request: Request) {
  const user = await getCurrentUser();

  const dateParam = new URL(request.url).searchParams.get("date");
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : defaultScheduleDate();

  const schedule = await getDaySchedule(date, { includeDuty: Boolean(user) });
  return NextResponse.json({ schedule, canOpenAdmin: user ? canOpenScheduleAdmin(user) : false });
}
