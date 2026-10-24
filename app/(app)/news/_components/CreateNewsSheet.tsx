"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/shared/BottomSheet";
import type { NewsFeedItem } from "@/lib/server/news";

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function CreateNewsSheet({
  open,
  onOpenChange,
  editingPost,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingPost: NewsFeedItem | null;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [hasEvent, setHasEvent] = useState(false);
  const [eventLocal, setEventLocal] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Reset the form fields the moment the sheet opens - done during render
  // (React's documented "adjusting state when a prop changes" pattern), not
  // in a useEffect, so it can't cause the extra cascading-render pass a
  // post-paint effect would.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setTitle(editingPost?.title ?? "");
      setBody(editingPost?.body ?? "");
      setHasEvent(Boolean(editingPost?.eventAt));
      setEventLocal(editingPost?.eventAt ? toLocalInputValue(new Date(editingPost.eventAt)) : "");
      setIsPinned(editingPost?.isPinned ?? false);
    }
  }

  async function submit() {
    if (!title.trim() || !body.trim() || submitting) return;
    setSubmitting(true);
    const payload = {
      title: title.trim(),
      body: body.trim(),
      eventAt: hasEvent && eventLocal ? new Date(eventLocal).toISOString() : null,
      isPinned,
    };
    try {
      const res = editingPost
        ? await fetch(`/api/news/${editingPost.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/news", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (res.ok) {
        onOpenChange(false);
        onSaved();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={editingPost ? "Редагувати оголошення" : "Нове оголошення"}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-ink-muted" htmlFor="news-title">
            Заголовок
          </label>
          <input
            id="news-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-xl bg-surface px-3 py-2.5 text-sm outline-none ring-accent focus:ring-2"
            placeholder="Наприклад: Збір у понеділок"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-ink-muted" htmlFor="news-body">
            Текст
          </label>
          <textarea
            id="news-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            className="resize-none rounded-xl bg-surface px-3 py-2.5 text-sm outline-none ring-accent focus:ring-2"
            placeholder="Про що оголошення..."
          />
        </div>

        <label className="flex items-center justify-between rounded-xl bg-surface px-3 py-2.5">
          <span className="text-sm">Закріпити зверху</span>
          <input
            type="checkbox"
            checked={isPinned}
            onChange={(e) => setIsPinned(e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
        </label>

        <label className="flex items-center justify-between rounded-xl bg-surface px-3 py-2.5">
          <span className="text-sm">Є конкретна дата/час</span>
          <input
            type="checkbox"
            checked={hasEvent}
            onChange={(e) => setHasEvent(e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
        </label>

        {hasEvent && (
          <input
            type="datetime-local"
            value={eventLocal}
            onChange={(e) => setEventLocal(e.target.value)}
            className="rounded-xl bg-surface px-3 py-2.5 text-sm outline-none ring-accent focus:ring-2"
          />
        )}

        <button
          type="button"
          onClick={submit}
          disabled={!title.trim() || !body.trim() || submitting}
          className="mt-2 rounded-full bg-ink py-3 text-sm font-medium text-background transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          {editingPost ? "Зберегти" : "Опублікувати"}
        </button>
      </div>
    </BottomSheet>
  );
}
