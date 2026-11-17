"use client";

import type { SlotContent } from "@/lib/schedule/resolve";

export function ClassCard({ content }: { content: SlotContent }) {
  if (!content) {
    return (
      <div className="flex min-h-[64px] flex-col items-center justify-center rounded-xl bg-surface/50 text-center">
        <span className="text-[11px] text-ink-muted">вікно</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-[64px] flex-col justify-start gap-1.5 rounded-xl bg-surface p-2.5">
      <p
        className={`line-clamp-2 text-sm font-semibold leading-tight ${content.isCancelled ? "text-ink-muted line-through" : ""}`}
      >
        {content.subject}
      </p>
      {content.teacher && <p className="truncate text-xs text-ink-muted">{content.teacher}</p>}
      {content.room && <p className="truncate text-[11px] text-ink-muted/80">{content.room}</p>}
    </div>
  );
}
