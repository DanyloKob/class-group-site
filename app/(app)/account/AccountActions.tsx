"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { SignOut } from "@phosphor-icons/react";

export function AccountActions() {
  const router = useRouter();
  const [, startLogoutTransition] = useTransition();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    startLogoutTransition(() => {
      router.replace("/account");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={logout}
        className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm text-danger transition-transform active:scale-[0.98]"
      >
        <SignOut size={18} />
        Вийти
      </button>
    </div>
  );
}
