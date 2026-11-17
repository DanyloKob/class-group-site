import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { getDaySchedule } from "@/lib/server/schedule";
import { defaultScheduleDate } from "@/lib/schedule/parity";
import { canOpenScheduleAdmin } from "@/lib/schedule/permissions";
import { ScheduleDayView } from "@/components/schedule/ScheduleDayView";

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await getCurrentUser();

  const { date: dateParam } = await searchParams;
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : defaultScheduleDate();

  const schedule = await getDaySchedule(date, { includeDuty: Boolean(user) });

  return (
    <Suspense>
      <ScheduleDayView
        initialDateParam={date}
        initialSchedule={schedule}
        initialCanOpenAdmin={user ? canOpenScheduleAdmin(user) : false}
      />
    </Suspense>
  );
}
