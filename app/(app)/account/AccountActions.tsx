"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowClockwise, Moon, Sun, SignOut, ArrowCounterClockwise } from "@phosphor-icons/react";
import { pickInkForAccent } from "@/lib/color";

type Theme = "LIGHT" | "DARK";

export function AccountActions({
  hasTelegramLink,
  currentTheme,
  currentAccentColor,
  hasCustomAccentColor,
}: {
  hasTelegramLink: boolean;
  currentTheme: Theme;
  currentAccentColor: string;
  hasCustomAccentColor: boolean;
}) {
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>(currentTheme);
  const [accentColor, setAccentColor] = useState(currentAccentColor);
  const [isCustomAccent, setIsCustomAccent] = useState(hasCustomAccentColor);
  const [avatarStatus, setAvatarStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [, startLogoutTransition] = useTransition();

  async function setThemeAndPersist(next: Theme) {
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next === "LIGHT" ? "light" : "dark");
    await fetch("/api/account/theme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: next }),
    });
  }

  function applyAccent(hex: string | null) {
    const root = document.documentElement.style;
    if (hex) {
      root.setProperty("--color-accent", hex);
      root.setProperty("--color-accent-ink", pickInkForAccent(hex));
    } else {
      root.removeProperty("--color-accent");
      root.removeProperty("--color-accent-ink");
    }
  }

  async function setAccentAndPersist(hex: string | null) {
    setIsCustomAccent(hex !== null);
    // On reset, the swatch itself must fall back to the theme's own default
    // green - otherwise it keeps showing the discarded custom color even
    // though every other accent-colored element on screen already reverted.
    setAccentColor(hex ?? (theme === "LIGHT" ? "#059669" : "#34d399"));
    applyAccent(hex);
    await fetch("/api/account/accent-color", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accentColor: hex }),
    });
  }

  async function refreshAvatar() {
    if (avatarStatus === "loading") return;
    setAvatarStatus("loading");
    try {
      const res = await fetch("/api/account/avatar/refresh", { method: "POST" });
      if (res.ok) {
        setAvatarStatus("done");
        router.refresh();
      } else {
        setAvatarStatus("error");
      }
    } catch {
      // A dropped connection must not leave the spinner running forever.
      setAvatarStatus("error");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    startLogoutTransition(() => {
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={refreshAvatar}
        disabled={!hasTelegramLink || avatarStatus === "loading"}
        className="flex items-center justify-between rounded-xl bg-surface px-4 py-3 text-sm transition-transform active:scale-[0.98] disabled:opacity-40"
      >
        <span>Оновити аватар з Telegram</span>
        <ArrowClockwise size={18} className={avatarStatus === "loading" ? "animate-spin" : ""} />
      </button>
      {!hasTelegramLink && (
        <p className="-mt-4 text-xs text-ink-muted">
          Акаунт ще не прив&apos;язаний до Telegram, тож оновити аватар поки не можна.
        </p>
      )}
      {avatarStatus === "error" && (
        <p className="-mt-4 text-xs text-danger">Не вдалося оновити аватар. Спробуйте пізніше.</p>
      )}

      <div className="flex items-center justify-between rounded-xl bg-surface px-4 py-3">
        <span className="text-sm">Тема</span>
        <div className="relative flex rounded-full bg-surface-elevated p-0.5">
          {(["DARK", "LIGHT"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setThemeAndPersist(option)}
              aria-label={option === "DARK" ? "Темна тема" : "Світла тема"}
              aria-pressed={theme === option}
              className="relative z-10 flex h-8 w-8 items-center justify-center"
            >
              {theme === option && (
                <motion.div
                  layoutId="theme-toggle-active"
                  className="absolute inset-0 rounded-full bg-accent"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative">
                {option === "DARK" ? (
                  <Moon size={15} weight={theme === "DARK" ? "fill" : "regular"} className={theme === "DARK" ? "text-accent-ink" : "text-ink-muted"} />
                ) : (
                  <Sun size={15} weight={theme === "LIGHT" ? "fill" : "regular"} className={theme === "LIGHT" ? "text-accent-ink" : "text-ink-muted"} />
                )}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-surface px-4 py-3">
        <span className="text-sm">Колір сайту</span>
        <div className="flex items-center gap-3">
          {isCustomAccent && (
            <button
              type="button"
              onClick={() => setAccentAndPersist(null)}
              aria-label="Скинути колір до стандартного"
              className="text-ink-muted transition-opacity active:opacity-60"
            >
              <ArrowCounterClockwise size={16} />
            </button>
          )}
          <label className="relative h-8 w-8 overflow-hidden rounded-full ring-1 ring-border">
            <span className="absolute inset-0" style={{ backgroundColor: accentColor }} />
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccentAndPersist(e.target.value)}
              aria-label="Обрати колір акценту"
              className="absolute -inset-2 cursor-pointer opacity-0"
            />
          </label>
        </div>
      </div>

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
