import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarBlank, UsersFour, GearSix, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageDuty, canManageScheduleSettings } from "@/lib/schedule/permissions";

export default async function ScheduleAdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const mayEditDuty = canManageDuty(user);
  const maySettings = canManageScheduleSettings(user);
  if (!mayEditDuty && !maySettings) redirect("/schedule");

  // Every row here is also enforced on its own page and API route - this list
  // only decides what is worth showing. A duty manager sees one row and no
  // hint that the timetable screens exist.
  const links = [
    maySettings && { href: "/schedule/admin/templates", label: "Розклад пар", icon: CalendarBlank },
    mayEditDuty && { href: "/schedule/admin/duty", label: "Чергові", icon: UsersFour },
    maySettings && { href: "/schedule/admin/settings", label: "Чисельник/знаменник", icon: GearSix },
  ].filter((link): link is { href: string; label: string; icon: typeof CalendarBlank } => Boolean(link));

  return (
    <div className="flex h-full flex-col gap-4 px-5 py-6">
      <div className="flex items-center gap-3">
        <Link href="/schedule" className="flex h-8 w-8 items-center justify-center rounded-full bg-surface">
          <ArrowLeft size={16} />
        </Link>
        <h1 className="text-lg font-semibold">{maySettings ? "Керування розкладом" : "Керування черговими"}</h1>
      </div>

      <div className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl bg-surface">
        {links.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex items-center gap-3 px-4 py-3.5">
            <Icon size={18} className="text-ink-muted" />
            <span className="flex-1 text-sm">{label}</span>
            <CaretRight size={14} className="text-ink-muted" />
          </Link>
        ))}
      </div>
    </div>
  );
}
