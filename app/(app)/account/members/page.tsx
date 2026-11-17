import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { MembersManager } from "@/app/(app)/account/members/MembersManager";

export default async function MembersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/account");
  if (!user.isSuperAdmin) redirect("/account");

  const members = await prisma.user.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const shaped = members.map((m) => ({
    id: m.id,
    phone: m.phone,
    lastName: m.lastName,
    firstName: m.firstName,
    isSuperAdmin: m.isSuperAdmin,
    canManageDuty: m.canManageDuty,
    scheduleGroup: m.scheduleGroup,
    canPostMemories: m.canPostMemories,
    hasTelegramLink: m.telegramUserId !== null,
  }));

  return <MembersManager initialMembers={shaped} />;
}
