import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getDaySchedule } from "@/lib/server/schedule";
import { defaultScheduleDate } from "@/lib/schedule/parity";
import { canModerateHomework } from "@/lib/permissions";
import { canOpenScheduleAdmin } from "@/lib/schedule/permissions";
import { ScheduleDayView } from "@/components/schedule/ScheduleDayView";

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { date: dateParam } = await searchParams;
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : defaultScheduleDate();

  const schedule = await getDaySchedule(date, user.id);

  return (
    <Suspense>
      <ScheduleDayView
        initialDateParam={date}
        initialSchedule={schedule}
        initialCanModerate={canModerateHomework(user)}
        initialCanOpenAdmin={canOpenScheduleAdmin(user)}
      />
    </Suspense>
  );
}
