import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getDaySchedule } from "@/lib/server/schedule";
import { defaultScheduleDate } from "@/lib/schedule/parity";
import { canModerateHomework } from "@/lib/permissions";
import { canOpenScheduleAdmin } from "@/lib/schedule/permissions";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const dateParam = new URL(request.url).searchParams.get("date");
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : defaultScheduleDate();

  const schedule = await getDaySchedule(date, user.id);
  // Two separate answers on purpose: moderating homework and reaching
  // the admin area are different powers and used to share one flag.
  return NextResponse.json({
    schedule,
    canModerate: canModerateHomework(user),
    canOpenAdmin: canOpenScheduleAdmin(user),
  });
}
