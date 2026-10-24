"use client";

import { BookOpen } from "@phosphor-icons/react";
import type { SlotContent } from "@/lib/schedule/resolve";

export function ClassCard({
  content,
  homeworkCount,
  onOpenHomework,
}: {
  content: SlotContent;
  homeworkCount: number;
  onOpenHomework: () => void;
}) {
  if (!content) {
    return (
      <div className="flex min-h-[72px] flex-col items-center justify-center rounded-xl bg-surface/50 text-center">
        <span className="text-[11px] text-ink-muted">вікно</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-[72px] flex-col justify-between gap-1.5 rounded-xl bg-surface p-2.5">
      <div>
        <p
          className={`line-clamp-2 text-sm font-semibold leading-tight ${content.isCancelled ? "text-ink-muted line-through" : ""}`}
        >
          {content.subject}
        </p>
        {content.teacher && <p className="truncate text-xs text-ink-muted">{content.teacher}</p>}
        {content.room && <p className="truncate text-[11px] text-ink-muted/80">{content.room}</p>}
      </div>
      <button
        type="button"
        onClick={onOpenHomework}
        className="flex w-fit items-center gap-1 rounded-full bg-surface-elevated px-2.5 py-1.5 text-[11px] transition-transform active:scale-95"
      >
        <BookOpen size={11} />
        ДЗ{homeworkCount > 0 && ` · ${homeworkCount}`}
      </button>
    </div>
  );
}
