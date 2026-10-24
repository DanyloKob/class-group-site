"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { BottomSheet } from "@/components/shared/BottomSheet";

type Status = "UNPAID" | "PAID" | "PAID_WITH_NOTE";

const OPTIONS: { value: Status; label: string }[] = [
  { value: "UNPAID", label: "Не здано" },
  { value: "PAID", label: "Здано" },
  { value: "PAID_WITH_NOTE", label: "З приміткою" },
];

export function PaymentStatusSheet({
  open,
  onOpenChange,
  taskId,
  userId,
  memberName,
  initialStatus,
  initialNote,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  userId: string;
  memberName: string;
  initialStatus: Status;
  initialNote: string | null;
  onSaved: (status: Status, note: string | null) => void;
}) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [note, setNote] = useState(initialNote ?? "");
  const [submitting, setSubmitting] = useState(false);

  // See CreateNewsSheet.tsx for why this runs during render, not in an effect.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStatus(initialStatus);
      setNote(initialNote ?? "");
    }
  }

  async function save() {
    if (status === "PAID_WITH_NOTE" && !note.trim()) return;
    setSubmitting(true);
    try {
      if (status === "UNPAID") {
        await fetch(`/api/tasks/${taskId}/fundraiser/${userId}`, { method: "DELETE" });
        onSaved("UNPAID", null);
      } else {
        await fetch(`/api/tasks/${taskId}/fundraiser/${userId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, note: status === "PAID_WITH_NOTE" ? note.trim() : null }),
        });
        onSaved(status, status === "PAID_WITH_NOTE" ? note.trim() : null);
      }
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={memberName}>
      <div className="flex flex-col gap-4">
        <div className="relative flex rounded-full bg-surface p-1">
          {OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setStatus(option.value)}
              className="relative z-10 flex-1 rounded-full py-2 text-xs font-medium"
            >
              {status === option.value && (
                <motion.div
                  layoutId={`payment-status-active-${userId}`}
                  className="absolute inset-0 -z-10 rounded-full bg-ink"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <span className={status === option.value ? "text-background" : "text-ink-muted"}>{option.label}</span>
            </button>
          ))}
        </div>

        {status === "PAID_WITH_NOTE" && (
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Наприклад: приніс 50 з 100 грн"
            className="resize-none rounded-xl bg-surface px-3 py-2.5 text-sm outline-none ring-accent focus:ring-2"
          />
        )}

        <button
          type="button"
          onClick={save}
          disabled={submitting || (status === "PAID_WITH_NOTE" && !note.trim())}
          className="rounded-full bg-ink py-3 text-sm font-medium text-background transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          Зберегти
        </button>
      </div>
    </BottomSheet>
  );
}
