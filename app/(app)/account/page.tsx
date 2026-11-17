import Image from "next/image";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { headers } from "next/headers";
import { isDevLoginEnabled } from "@/lib/auth/dev-login";
import { createTelegramLoginRequest, isTelegramBotConfigured } from "@/lib/server/telegramLogin";
import { TelegramLoginButton } from "@/app/(app)/account/_components/TelegramLoginButton";
import { DevLoginPicker } from "@/app/(app)/account/_components/DevLoginPicker";
import { UsersFour, ClockCounterClockwise, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { AccountActions } from "@/app/(app)/account/AccountActions";
import { permissionSummaryLabel } from "@/lib/permissions";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) {
    return <GuestLogin />;
  }

  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();

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

      <AccountActions />
    </div>
  );
}

async function GuestLogin() {
  const botConfigured = isTelegramBotConfigured();
  // Minted during render so the button ships as a plain <a href> that
  // Safari's popup blocker has no reason to touch.
  const requestHeaders = await headers();
  const loginLink = botConfigured
    ? await createTelegramLoginRequest({
        ipAddress: requestHeaders.get("x-forwarded-for"),
        userAgent: requestHeaders.get("user-agent"),
      })
    : null;

  return (
    <div className="flex h-full flex-col items-center justify-center-safe gap-8 overflow-y-auto px-8 py-8 text-center">
      <div className="space-y-4">
        <Image src="/emblem.png" alt="" width={88} height={88} priority className="mx-auto" />
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">L-23 LIFE</h1>
          <p className="text-sm text-ink-muted">
            Увійдіть, щоб додавати теми й матеріали, бачити чергових і спогади.
          </p>
        </div>
      </div>

      <TelegramLoginButton botConfigured={botConfigured} initialLink={loginLink} />

      {isDevLoginEnabled() && <DevLoginPicker />}
    </div>
  );
}
