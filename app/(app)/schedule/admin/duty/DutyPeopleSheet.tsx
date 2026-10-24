"use client";

import { useMemo, useState } from "react";
import { Check, MagnifyingGlass } from "@phosphor-icons/react";
import { BottomSheet } from "@/components/shared/BottomSheet";

export type Member = { id: string; firstName: string; lastName: string };

type SortMode = "queue" | "alpha";

export function DutyPeopleSheet({
  open,
  onOpenChange,
  title,
  members,
  selectedIds,
  /** How many times each person already has this duty in the visible month -
   * the whole point of the screen is spreading turns evenly across 33 people. */
  monthCounts,
  /** The page's own error banner sits under the sheet's overlay, so a failed
   * save has to be said here too or the tick just silently flips back. */
  saveFailed,
  onToggle,
  onClearAll,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  members: Member[];
  selectedIds: string[];
  monthCounts: Record<string, number>;
  saveFailed: boolean;
  onToggle: (personId: string) => void;
  onClearAll: () => void;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("queue");

  // The order is frozen for as long as the sheet stays open. Re-sorting live
  // on every tap would slide the next name out from under the finger, which
  // is exactly the wrong behaviour when filling a whole month in one sitting.
  const [frozenOrder, setFrozenOrder] = useState<string[] | null>(null);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setFrozenOrder(null);
    }
  }

  const ordered = useMemo(() => {
    const byId = new Map(members.map((m) => [m.id, m]));
    if (frozenOrder) {
      return frozenOrder.map((id) => byId.get(id)).filter((m): m is Member => Boolean(m));
    }
    const list = [...members];
    if (sort === "queue") {
      list.sort(
        (a, b) =>
          (monthCounts[a.id] ?? 0) - (monthCounts[b.id] ?? 0) ||
          a.lastName.localeCompare(b.lastName, "uk"),
      );
    } else {
      list.sort((a, b) => a.lastName.localeCompare(b.lastName, "uk"));
    }
    return list;
  }, [members, monthCounts, sort, frozenOrder]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return ordered;
    return ordered.filter((m) => `${m.lastName} ${m.firstName}`.toLowerCase().includes(needle));
  }, [ordered, query]);

  function toggle(personId: string) {
    if (!frozenOrder) setFrozenOrder(ordered.map((m) => m.id));
    onToggle(personId);
  }

  function changeSort(next: SortMode) {
    setFrozenOrder(null);
    setSort(next);
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={title}>
      <div className="flex flex-col gap-3">
        {saveFailed && (
          <p className="rounded-xl bg-danger/10 px-3 py-2.5 text-xs text-danger">
            Не вдалося зберегти зміну. Список оновлено з сервера — спробуйте ще раз.
          </p>
        )}
        <div className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2.5">
          <MagnifyingGlass size={15} className="shrink-0 text-ink-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Пошук за прізвищем"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-muted"
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex rounded-full bg-surface p-0.5">
            {(
              [
                { value: "queue", label: "За чергою" },
                { value: "alpha", label: "За абеткою" },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => changeSort(option.value)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors ${
                  sort === option.value ? "bg-ink text-background" : "text-ink-muted"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="shrink-0 text-[11px] text-ink-muted transition-opacity active:opacity-60"
            >
              Прибрати всіх
            </button>
          )}
        </div>

        <div className="flex flex-col">
          {visible.map((member) => {
            const selected = selectedIds.includes(member.id);
            const count = monthCounts[member.id] ?? 0;
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => toggle(member.id)}
                className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors active:bg-surface"
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                    selected ? "border-accent bg-accent" : "border-border"
                  }`}
                >
                  {selected && <Check size={12} weight="bold" className="text-accent-ink" />}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {member.lastName} {member.firstName}
                </span>
                {count > 0 && (
                  <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[11px] text-ink-muted">
                    ×{count}
                  </span>
                )}
              </button>
            );
          })}
          {visible.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-ink-muted">Нікого не знайдено.</p>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
