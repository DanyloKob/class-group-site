"use client";

import { useState } from "react";
import { Bell, BellSlash } from "@phosphor-icons/react";

type Preferences = {
  notifyTasks: boolean;
  notifyNews: boolean;
  notifyHomework: boolean;
  notifyMemories: boolean;
};

const CATEGORY_OPTIONS: { key: keyof Preferences; label: string }[] = [
  { key: "notifyTasks", label: "Завдання" },
  { key: "notifyNews", label: "Оголошення" },
  { key: "notifyHomework", label: "Нове ДЗ" },
  { key: "notifyMemories", label: "Нове у Спогадах" },
];

// Web Push needs the VAPID key as raw bytes, not the base64url string the
// server hands out - this is the standard conversion every push tutorial
// reaches for, there's no browser API that does it directly.
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function NotificationSettings({
  initialSubscribed,
  initialPreferences,
}: {
  initialSubscribed: boolean;
  initialPreferences: Preferences;
}) {
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [preferences, setPreferences] = useState(initialPreferences);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  async function enable() {
    if (status === "loading") return;
    setStatus("loading");
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        throw new Error("unsupported");
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("error");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        setStatus("error");
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const res = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!res.ok) throw new Error("subscribe_failed");

      setSubscribed(true);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  async function disable() {
    if (status === "loading") return;
    setStatus("loading");
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/notifications/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setSubscribed(false);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  async function togglePreference(key: keyof Preferences, value: boolean) {
    setPreferences((prev) => ({ ...prev, [key]: value }));
    await fetch("/api/notifications/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={subscribed ? disable : enable}
        disabled={status === "loading"}
        className="flex items-center justify-between rounded-xl bg-surface px-4 py-3 text-sm transition-transform active:scale-[0.98] disabled:opacity-40"
      >
        <span className="flex items-center gap-2">
          {subscribed ? <Bell size={18} weight="fill" className="text-accent" /> : <BellSlash size={18} className="text-ink-muted" />}
          Сповіщення
        </span>
        <span className="text-xs text-ink-muted">{subscribed ? "Увімкнено" : "Увімкнути"}</span>
      </button>

      {status === "error" && (
        <p className="-mt-1 px-1 text-xs text-danger">
          Не вдалося увімкнути сповіщення. На iPhone спершу додайте сайт на головний екран (Поділитись →
          На екран «Домівка»), інакше Safari їх не дозволяє.
        </p>
      )}

      {subscribed && (
        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-xl bg-surface">
          {CATEGORY_OPTIONS.map(({ key, label }) => (
            <label key={key} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm">{label}</span>
              <input
                type="checkbox"
                checked={preferences[key]}
                onChange={(e) => togglePreference(key, e.target.checked)}
                className="h-4 w-4 accent-accent"
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
