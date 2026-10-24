import Image from "next/image";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { isDevLoginEnabled } from "@/lib/auth/dev-login";
import { createTelegramLoginRequest, isTelegramBotConfigured } from "@/lib/server/telegramLogin";
import { TelegramLoginButton } from "@/app/(auth)/login/TelegramLoginButton";
import { DevLoginPicker } from "@/app/(auth)/login/DevLoginPicker";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/tasks");
  }

  const botConfigured = isTelegramBotConfigured();
  // Minted here, during render, so the button ships as a plain <a href> that
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
        <Image src="/emblem.png" alt="" width={104} height={104} priority className="mx-auto" />
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">L-23 LIFE</h1>
          <p className="text-sm text-ink-muted">
            Увійдіть за номером телефону, яким вас зареєстрував адміністратор.
          </p>
        </div>
      </div>

      <TelegramLoginButton botConfigured={botConfigured} initialLink={loginLink} />

      {isDevLoginEnabled() && <DevLoginPicker />}
    </div>
  );
}
