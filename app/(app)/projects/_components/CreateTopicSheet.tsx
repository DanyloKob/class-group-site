"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/shared/BottomSheet";
import { todayInKyiv } from "@/lib/schedule/parity";

const FIELD = "rounded-xl bg-surface px-3 py-2.5 text-sm outline-none ring-accent focus:ring-2 [color-scheme:dark]";

export function CreateTopicSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = title.trim().length > 0 && dueDate !== "" && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/projects/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          dueDate,
          ...(subject.trim() ? { subject: subject.trim() } : {}),
        }),
      });
      if (!res.ok) {
        setError("Не вдалося створити тему. Перевірте дані.");
        return;
      }
      setTitle("");
      setSubject("");
      setDueDate("");
      onOpenChange(false);
      router.refresh();
    } catch {
      setError("Не вдалося створити тему. Перевірте дані.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="Нова тема">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-ink-muted" htmlFor="topic-title">
            Назва
          </label>
          <input
            id="topic-title"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            className={FIELD}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-ink-muted" htmlFor="topic-subject">
            Предмет (необов&apos;язково)
          </label>
          <input
            id="topic-subject"
            value={subject}
            maxLength={60}
            onChange={(e) => setSubject(e.target.value)}
            className={FIELD}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-ink-muted" htmlFor="topic-due">
            На коли
          </label>
          <input
            id="topic-due"
            type="date"
            min={todayInKyiv()}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={FIELD}
          />
        </div>

        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="mt-2 rounded-full bg-ink py-3 text-sm font-medium text-background transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          Створити
        </button>
      </div>
    </BottomSheet>
  );
}
