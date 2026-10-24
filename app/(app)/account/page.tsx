import Image from "next/image";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { UsersFour, ClockCounterClockwise, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { AccountActions } from "@/app/(app)/account/AccountActions";
import { NotificationSettings } from "@/app/(app)/account/NotificationSettings";
import { permissionSummaryLabel } from "@/lib/permissions";
import { prisma } from "@/lib/db";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();
  const hasSubscription = (await prisma.pushSubscription.count({ where: { userId: user.id } })) > 0;

  return (
    <div className="flex h-full flex-col gap-8 overflow-y-auto px-6 py-10">
      <div className="flex shrink-0 flex-col items-center gap-3">
        <div className="relative h-20 w-20 overflow-hidden rounded-full bg-surface-elevated">
          {user.avatarUrl ? (
            <Image src={user.avatarUrl} alt="" fill sizes="80px" className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl font-medium text-ink-muted">
              {initials}
            </div>
          )}
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold">
            {user.firstName} {user.lastName}
          </p>
          <p className="text-xs text-ink-muted">{permissionSummaryLabel(user)}</p>
        </div>
      </div>

      {user.isSuperAdmin && (
        <div className="flex shrink-0 flex-col divide-y divide-border overflow-hidden rounded-xl bg-surface">
          <Link
            href="/account/members"
            className="flex items-center gap-3 px-4 py-3 transition-transform active:scale-[0.98]"
          >
            <UsersFour size={18} className="text-ink-muted" />
            <span className="flex-1 text-sm">Учасники групи</span>
            <CaretRight size={14} className="text-ink-muted" />
          </Link>
          <Link
            href="/account/audit"
            className="flex items-center gap-3 px-4 py-3 transition-transform active:scale-[0.98]"
          >
            <ClockCounterClockwise size={18} className="text-ink-muted" />
            <span className="flex-1 text-sm">Дії</span>
            <CaretRight size={14} className="text-ink-muted" />
          </Link>
        </div>
      )}

      <NotificationSettings
        initialSubscribed={hasSubscription}
        initialPreferences={{
          notifyTasks: user.notifyTasks,
          notifyNews: user.notifyNews,
          notifyHomework: user.notifyHomework,
          notifyMemories: user.notifyMemories,
        }}
      />

      <AccountActions
        hasTelegramLink={user.telegramUserId !== null}
        currentTheme={user.theme}
        currentAccentColor={user.accentColor ?? (user.theme === "LIGHT" ? "#059669" : "#34d399")}
        hasCustomAccentColor={user.accentColor !== null}
      />
    </div>
  );
}
