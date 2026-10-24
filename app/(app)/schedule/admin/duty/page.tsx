import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageDuty } from "@/lib/schedule/permissions";
import { prisma } from "@/lib/db";
import { academicYearRange, todayInKyiv } from "@/lib/schedule/parity";
import { DutyAdminEditor } from "@/app/(app)/schedule/admin/duty/DutyAdminEditor";

export default async function DutyAdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canManageDuty(user)) redirect("/schedule");

  const members = await prisma.user.findMany({
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  // Month navigation is fenced to the Sept-May school year, the same window
  // the schedule tab itself can reach - there is nothing to roster outside it.
  const today = todayInKyiv();
  const { start, end } = academicYearRange(today);
  const minMonth = start.slice(0, 7);
  const maxMonth = end.slice(0, 7);
  const thisMonth = today.slice(0, 7);
  const initialMonth = thisMonth < minMonth ? minMonth : thisMonth > maxMonth ? maxMonth : thisMonth;

  return (
    <DutyAdminEditor
      members={members}
      initialMonth={initialMonth}
      minMonth={minMonth}
      maxMonth={maxMonth}
    />
  );
}
