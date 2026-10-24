import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageScheduleSettings } from "@/lib/schedule/permissions";
import { TemplatesAdminEditor } from "@/app/(app)/schedule/admin/templates/TemplatesAdminEditor";

export default async function TemplatesAdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canManageScheduleSettings(user)) redirect("/schedule");

  return <TemplatesAdminEditor />;
}
