"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleNotch } from "@phosphor-icons/react";

const POLL_MS = 3000;
const MAX_MS = 5 * 60 * 1000;

/**
 * Shown while a PPTX is being converted to slides. Polls the public status
 * endpoint and refreshes the server page as soon as the status changes.
 */
export function ConversionWaiter({ token }: { token: string }) {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    let stopped = false;
    const startedAt = Date.now();

    async function tick() {
      if (stopped) return;
      if (Date.now() - startedAt > MAX_MS) {
        setTimedOut(true);
        return;
      }
      try {
        const res = await fetch(`/api/materials/${encodeURIComponent(token)}/status`, { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as { conversionStatus: string | null };
          if (data.conversionStatus !== "PENDING") {
            router.refresh();
            return;
          }
        }
      } catch {
        // Offline blip: just try again on the next tick.
      }
      if (!stopped) timer = setTimeout(tick, POLL_MS);
    }

    let timer = setTimeout(tick, POLL_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [token, router]);

  return (
    <div role="status" className="flex items-center gap-3 rounded-2xl bg-surface p-4 text-sm text-ink">
      {!timedOut && <CircleNotch size={18} className="shrink-0 animate-spin text-accent motion-reduce:animate-none" />}
      <span>{timedOut ? "Підготовка триває довше, ніж зазвичай. Оновіть сторінку трохи пізніше." : "Готуємо слайди…"}</span>
    </div>
  );
}
