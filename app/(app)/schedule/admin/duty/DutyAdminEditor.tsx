"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CaretLeft, CaretRight, ForkKnife, PencilSimpleLine, Plus } from "@phosphor-icons/react";
import type { DutyType } from "@/lib/generated/prisma/enums";
import { dayLongLabel, monthLabel, monthWeekdays, stepMonth, toDateParam, weekdayShortLabel } from "@/lib/schedule/dateRange";
import { DutyPeopleSheet, type Member } from "@/app/(app)/schedule/admin/duty/DutyPeopleSheet";

type Cell = { date: string; dutyType: DutyType };

const DUTY_META: { dutyType: DutyType; label: string; icon: typeof ForkKnife }[] = [
  { dutyType: "CAFETERIA", label: "Їдальня", icon: ForkKnife },
  { dutyType: "BOARD", label: "Дошка", icon: PencilSimpleLine },
];

const cellKey = (date: string, dutyType: DutyType) => `${date}|${dutyType}`;

export function DutyAdminEditor({
  members,
  initialMonth,
  minMonth,
  maxMonth,
}: {
  members: Member[];
  initialMonth: string;
  minMonth: string;
  maxMonth: string;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  // Bumped to re-read the month from the server - after a failed load (retry)
  // or a failed save, where the optimistic list no longer matches the DB.
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState<"load" | "save" | null>(null);
  const [cell, setCell] = useState<Cell | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Every write goes through one promise chain, so two quick taps can never
  // land out of order and resurrect the list the earlier tap replaced.
  const saveChain = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    let stale = false;
    // Queued behind pending saves: a read that overtakes an in-flight PUT
    // (switch month and back mid-save) returns the old roster, the cell shows
    // empty, and the next tap on it PUTs from [] and wipes the real one.
    saveChain.current
      .then(() => fetch(`/api/schedule/admin/duty?month=${month}`))
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: { assignments?: { date: string; dutyType: DutyType; personId: string }[] }) => {
        if (stale) return;
        const next: Record<string, string[]> = {};
        for (const row of data.assignments ?? []) {
          const key = cellKey(row.date, row.dutyType);
          (next[key] ??= []).push(row.personId);
        }
        setAssignments(next);
        setLoading(false);
      })
      .catch(() => {
        if (stale) return;
        setError("load");
        setLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [month, reloadKey]);

  function reload() {
    setLoading(true);
    setReloadKey((k) => k + 1);
  }

  // setLoading lives here rather than in the fetch effect: the effect is a
  // subscription to "whatever month is selected", and flipping state inside
  // its body is the cascading-render pattern React lints against.
  function goToMonth(direction: 1 | -1) {
    setLoading(true);
    setError(null);
    setMonth((current) => stepMonth(current, direction));
  }

  const days = useMemo(() => monthWeekdays(month), [month]);

  const monthCounts = useMemo(() => {
    const perType: Record<DutyType, Record<string, number>> = { CAFETERIA: {}, BOARD: {} };
    const total: Record<string, number> = {};
    for (const [key, ids] of Object.entries(assignments)) {
      const dutyType = key.split("|")[1] as DutyType;
      for (const id of ids) {
        perType[dutyType][id] = (perType[dutyType][id] ?? 0) + 1;
        total[id] = (total[id] ?? 0) + 1;
      }
    }
    return { perType, total };
  }, [assignments]);

  const summary = useMemo(() => {
    let cafeteria = 0;
    let board = 0;
    for (const [key, ids] of Object.entries(assignments)) {
      if (key.endsWith("|CAFETERIA")) cafeteria += ids.length;
      else board += ids.length;
    }
    const untouched = members.filter((m) => !monthCounts.total[m.id]).length;
    return { cafeteria, board, untouched };
  }, [assignments, members, monthCounts]);

  function save(date: string, dutyType: DutyType, personIds: string[]) {
    setError((current) => (current === "save" ? null : current));
    setAssignments((prev) => ({ ...prev, [cellKey(date, dutyType)]: personIds }));
    saveChain.current = saveChain.current.then(() =>
      fetch("/api/schedule/admin/duty", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, dutyType, personIds }),
      })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        })
        .catch(() => {
          // Used to be swallowed silently: the name stayed ticked on screen
          // while the server never stored it, so it was simply gone after a
          // reload. Say so, and put the real roster back on screen.
          setError("save");
          reload();
        }),
    );
  }

  function peopleIn(date: string, dutyType: DutyType): string[] {
    return assignments[cellKey(date, dutyType)] ?? [];
  }

  function nameOf(personId: string): string {
    const member = members.find((m) => m.id === personId);
    return member ? `${member.lastName} ${member.firstName[0]}.` : "—";
  }

  const canGoBack = month > minMonth;
  const canGoForward = month < maxMonth;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex shrink-0 flex-col gap-3 px-5 pb-3 pt-6">
        <div className="flex items-center gap-3">
          <Link href="/schedule/admin" className="flex h-8 w-8 items-center justify-center rounded-full bg-surface">
            <ArrowLeft size={16} />
          </Link>
          <h1 className="text-lg font-semibold">Чергові</h1>
        </div>

        <div className="flex items-center justify-between rounded-full bg-surface px-1.5 py-1.5">
          <button
            type="button"
            disabled={!canGoBack}
            onClick={() => goToMonth(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-transform active:scale-90 disabled:opacity-25"
          >
            <CaretLeft size={16} />
          </button>
          <span className="text-sm font-medium">{monthLabel(month)}</span>
          <button
            type="button"
            disabled={!canGoForward}
            onClick={() => goToMonth(1)}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-transform active:scale-90 disabled:opacity-25"
          >
            <CaretRight size={16} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[11px] text-ink-muted">
            <ForkKnife size={12} />
            {summary.cafeteria}
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[11px] text-ink-muted">
            <PencilSimpleLine size={12} />
            {summary.board}
          </span>
          {/* The fairness signal gets the accent: with 33 people rotating,
              "who has not had a turn yet" is the number worth watching. */}
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] ${
              summary.untouched > 0 ? "bg-accent/12 text-accent" : "bg-surface text-ink-muted"
            }`}
          >
            {summary.untouched > 0
              ? `ще не чергували · ${summary.untouched}`
              : "усі мають чергування"}
          </span>
        </div>
      </div>

      {error && (
        <div className="mx-5 mb-2 flex items-center justify-between gap-3 rounded-xl bg-danger/10 px-3 py-2.5 text-xs text-danger">
          <span>{error === "load" ? "Не вдалося завантажити чергових." : "Не вдалося зберегти зміну."}</span>
          <button
            type="button"
            onClick={() => {
              setError(null);
              reload();
            }}
            className="shrink-0 font-medium transition-opacity active:opacity-60"
          >
            Оновити
          </button>
        </div>
      )}

      {/* Inert until the month has loaded: a cell tapped before that starts
          from an empty list, and PUT replaces the whole roster - the old
          names were wiped and the late GET then hid the new one too. */}
      <div
        className={`flex flex-col gap-2 px-5 pb-8 transition-opacity ${loading || error === "load" ? "pointer-events-none opacity-40" : ""}`}
        aria-busy={loading}
      >
        {days.map((day) => {
          const date = toDateParam(day);
          return (
            <div key={date} className="overflow-hidden rounded-2xl bg-surface">
              <div className="flex items-baseline gap-2 px-4 pb-1 pt-3">
                <span className="text-sm font-semibold">{day.getDate()}</span>
                <span className="text-[11px] uppercase tracking-wide text-ink-muted">
                  {weekdayShortLabel(day)}
                </span>
              </div>
              <div className="flex flex-col divide-y divide-border">
                {DUTY_META.map(({ dutyType, label, icon: Icon }) => {
                  const ids = peopleIn(date, dutyType);
                  return (
                    <button
                      key={dutyType}
                      type="button"
                      onClick={() => {
                        setCell({ date, dutyType });
                        setSheetOpen(true);
                      }}
                      className="flex items-center gap-2.5 px-4 py-3 text-left transition-opacity active:opacity-60"
                    >
                      <Icon size={15} className="shrink-0 text-ink-muted" />
                      <span className="min-w-0 flex-1 text-xs leading-relaxed">
                        {ids.length > 0 ? (
                          ids.map(nameOf).join(" · ")
                        ) : (
                          <span className="text-ink-muted">{label}</span>
                        )}
                      </span>
                      {ids.length === 0 ? (
                        <Plus size={14} className="shrink-0 text-ink-muted" />
                      ) : (
                        <CaretRight size={13} className="shrink-0 text-ink-muted" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {cell && (
        <DutyPeopleSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title={`${DUTY_META.find((d) => d.dutyType === cell.dutyType)!.label} · ${dayLongLabel(cell.date)}`}
          members={members}
          selectedIds={peopleIn(cell.date, cell.dutyType)}
          monthCounts={monthCounts.perType[cell.dutyType]}
          saveFailed={error === "save"}
          onToggle={(personId) => {
            const current = peopleIn(cell.date, cell.dutyType);
            const next = current.includes(personId)
              ? current.filter((id) => id !== personId)
              : [...current, personId];
            save(cell.date, cell.dutyType, next);
          }}
          onClearAll={() => save(cell.date, cell.dutyType, [])}
        />
      )}
    </div>
  );
}
