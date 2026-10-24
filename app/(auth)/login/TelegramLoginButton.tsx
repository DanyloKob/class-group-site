"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { PaperPlaneTilt } from "@phosphor-icons/react";

type FlowState =
  | { kind: "idle" }
  | { kind: "waiting" }
  | { kind: "failed"; reason?: string | null }
  | { kind: "expired" };

type LoginLink = { token: string; deepLink: string };

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;
// Tokens live 5 minutes; refresh a minute early so a page left open on the
// login screen still has a live link whenever it is finally tapped.
const LINK_REFRESH_MS = 4 * 60 * 1000;
// Telegram's in-app browser tears the page down when it jumps to the chat, so
// the pending token has to outlive this document to be picked back up.
const PENDING_KEY = "l23_pending_login_token";

function readPendingToken(): string | null {
  try {
    return sessionStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}

function writePendingToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(PENDING_KEY, token);
    else sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // Private-mode Safari can throw on sessionStorage; the flow still works in
    // this tab, it just can't be resumed after a reload.
  }
}

export function TelegramLoginButton({
  botConfigured,
  initialLink,
}: {
  botConfigured: boolean;
  initialLink: LoginLink | null;
}) {
  const router = useRouter();
  const [link, setLink] = useState<LoginLink | null>(initialLink);
  const [state, setState] = useState<FlowState>({ kind: "idle" });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollOnceRef = useRef<(() => void) | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    pollOnceRef.current = null;
  }, []);

  const refreshLink = useCallback(async () => {
    const res = await fetch("/api/auth/telegram/start", { method: "POST" });
    if (!res.ok) return null;
    const next: LoginLink = await res.json();
    setLink(next);
    return next;
  }, []);

  const beginPolling = useCallback(
    (token: string) => {
      stopPolling();
      writePendingToken(token);

      const deadline = Date.now() + POLL_TIMEOUT_MS;
      let inFlight = false;

      const tick = async () => {
        if (inFlight) return;
        if (Date.now() > deadline) {
          stopPolling();
          writePendingToken(null);
          setState({ kind: "expired" });
          void refreshLink();
          return;
        }
        inFlight = true;
        try {
          const res = await fetch(`/api/auth/telegram/status/${token}`);
          const data = await res.json();
          if (data.status === "SUCCESS") {
            stopPolling();
            writePendingToken(null);
            router.push("/tasks");
            router.refresh();
          } else if (data.status === "FAILED") {
            stopPolling();
            writePendingToken(null);
            setState({ kind: "failed", reason: data.failureReason });
            void refreshLink();
          } else if (data.status === "EXPIRED") {
            stopPolling();
            writePendingToken(null);
            setState({ kind: "expired" });
            void refreshLink();
          } else {
            // Still PENDING. Announcing "waiting" from here rather than up
            // front is what lets the resume-after-reload path start polling
            // without any state write in the effect body itself.
            setState((prev) => (prev.kind === "waiting" ? prev : { kind: "waiting" }));
          }
        } catch {
          // A dropped request mid-poll is normal when the browser backgrounds
          // the tab to switch to Telegram; the next tick simply retries.
        } finally {
          inFlight = false;
        }
      };

      pollOnceRef.current = () => void tick();
      pollRef.current = setInterval(tick, POLL_INTERVAL_MS);
      void tick();
    },
    [refreshLink, router, stopPolling],
  );

  // Coming back from the Telegram app is the moment the answer is ready -
  // poll right then instead of waiting out the interval, so the app is
  // already open by the time the user is looking at it again.
  useEffect(() => {
    const onWake = () => {
      if (document.visibilityState === "visible") pollOnceRef.current?.();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    return () => {
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, []);

  // Resume a login that was started before Telegram's in-app browser replaced
  // this page - on the way back the document is new, but the token is not.
  useEffect(() => {
    const pending = readPendingToken();
    if (pending) beginPolling(pending);
  }, [beginPolling]);

  useEffect(() => stopPolling, [stopPolling]);

  useEffect(() => {
    if (!botConfigured) return;
    const timer = setInterval(() => {
      if (!pollRef.current) void refreshLink();
    }, LINK_REFRESH_MS);
    return () => clearInterval(timer);
  }, [botConfigured, refreshLink]);

  const disabled = !botConfigured || !link;

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <motion.a
        // A real anchor, not a button that calls window.open() after an await:
        // Safari and the Telegram in-app browser both block the latter, which
        // is why the tap did nothing there.
        href={link?.deepLink ?? "#"}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={disabled}
        onClick={(event) => {
          if (disabled) {
            event.preventDefault();
            return;
          }
          setState({ kind: "waiting" });
          beginPolling(link.token);
        }}
        whileTap={disabled ? undefined : { scale: 0.97 }}
        transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
        className={`flex w-full max-w-[280px] items-center justify-center gap-2 rounded-full bg-ink px-6 py-3.5 text-sm font-medium text-background ${
          disabled ? "pointer-events-none opacity-40" : ""
        }`}
      >
        <PaperPlaneTilt size={18} weight="fill" />
        Увійти через Telegram
      </motion.a>

      <AnimatePresence mode="wait">
        {!botConfigured && (
          <motion.p
            key="not-configured"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="max-w-[280px] text-xs text-ink-muted"
          >
            Telegram-вхід ще не налаштований адміністратором.
          </motion.p>
        )}
        {state.kind === "waiting" && (
          <motion.div
            key="waiting"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex max-w-[280px] flex-col items-center gap-2"
          >
            <p className="text-xs text-ink-muted">
              Очікуємо підтвердження в Telegram. Поділіться контактом у боті.
            </p>
            {link && (
              // Deliberately same-tab, unlike the button above: if a WebView
              // swallowed the _blank open, navigating this document is the one
              // path left. The token is in sessionStorage, so polling picks
              // itself back up when Telegram returns the user here.
              <a
                href={link.deepLink}
                className="text-xs font-medium text-accent underline underline-offset-4"
              >
                Telegram не відкрився? Відкрити ще раз
              </a>
            )}
          </motion.div>
        )}
        {state.kind === "failed" && (
          <motion.p
            key="failed"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="max-w-[280px] text-xs text-danger"
          >
            {state.reason === "no_match"
              ? "Цей номер телефону не зареєстрований. Зверніться до адміністратора."
              : "Не вдалося увійти. Спробуйте ще раз."}
          </motion.p>
        )}
        {state.kind === "expired" && (
          <motion.p
            key="expired"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="max-w-[280px] text-xs text-ink-muted"
          >
            Час очікування вийшов. Натисніть кнопку ще раз.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
