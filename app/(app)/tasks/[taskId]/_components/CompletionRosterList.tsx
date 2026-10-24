"use client";

import { useState } from "react";
import { CaretDown, CheckCircle, Circle } from "@phosphor-icons/react";

type RosterRow = { userId: string; firstName: string; lastName: string; done: boolean };

export function CompletionRosterList({ taskId }: { taskId: string }) {
  const [open, setOpen] = useState(false);
  const [roster, setRoster] = useState<RosterRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && !roster) {
      setLoading(true);
      const res = await fetch(`/api/tasks/${taskId}/completions`);
      if (res.ok) {
        const data = await res.json();
        setRoster(data.roster);
      }
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl bg-surface">
      <button
        type="button"
        onClick={toggleOpen}
        disabled={loading}
        className="flex w-full items-center justify-between p-4 transition-opacity active:opacity-70 disabled:opacity-70"
      >
        <span className="text-sm font-medium">Хто виконав</span>
        <CaretDown size={16} className={`text-ink-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="flex flex-col divide-y divide-border px-4 pb-2">
          {loading && <p className="py-3 text-xs text-ink-muted">Завантаження...</p>}
          {roster?.map((row) => (
            <div key={row.userId} className="flex items-center justify-between py-2.5">
              <span className="text-sm">
                {row.lastName} {row.firstName}
              </span>
              {row.done ? (
                <CheckCircle size={16} weight="fill" className="text-success" />
              ) : (
                <Circle size={16} className="text-ink-muted" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
