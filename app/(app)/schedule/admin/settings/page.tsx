import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageScheduleSettings } from "@/lib/schedule/permissions";
import { getScheduleSettings } from "@/lib/server/schedule";
import { ScheduleSettingsForm } from "@/app/(app)/schedule/admin/settings/ScheduleSettingsForm";

export default async function ScheduleSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canManageScheduleSettings(user)) redirect("/schedule");

  const settings = await getScheduleSettings();

  return (
    <ScheduleSettingsForm
      initialAnchorDate={settings?.parityAnchorDate.toISOString().slice(0, 10) ?? ""}
      initialAnchorType={settings?.parityAnchorType ?? "NUMERATOR"}
    />
  );
}
