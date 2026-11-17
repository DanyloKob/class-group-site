"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CaretLeft, CaretRight, ForkKnife, PencilSimpleLine, Plus } from "@phosphor-icons/react";
import type { DutyType } from "@/lib/generated/prisma/enums";
import { dayLongLabel, monthLabel, monthWeekdays, stepMonth, toDateParam, weekdayShortLabel } from "@/lib/schedule/dateRange";
import { DutyPeopleSheet, type Member } from "@/app/(app)/schedule/admin/duty/DutyPeopleSheet";

type Cell = { date: string; dutyType: DutyType };
/** One name in one cell, with the editor who put it there. */
type Entry = { personId: string; createdById: string };
type OutsideCounts = Record<DutyType, Record<string, number>>;

type MonthResponse = {
  assignments?: { date: string; dutyType: DutyType; personId: string; createdById: string }[];
  countsOutsideMonth?: { personId: string; dutyType: DutyType; count: number }[];
};

const DUTY_META: { dutyType: DutyType; label: string; icon: typeof ForkKnife }[] = [
  { dutyType: "CAFETERIA", label: "Їдальня", icon: ForkKnife },
  { dutyType: "BOARD", label: "Дошка", icon: PencilSimpleLine },
];

const cellKey = (date: string, dutyType: DutyType) => `${date}|${dutyType}`;

const RESYNC_INTERVAL_MS = 60_000;

function parseMonth(data: MonthResponse): { assignments: Record<string, Entry[]>; outside: OutsideCounts } {
  const assignments: Record<string, Entry[]> = {};
  for (const row of data.assignments ?? []) {
    (assignments[cellKey(row.date, row.dutyType)] ??= []).push({
      personId: row.personId,
      createdById: row.createdById,
    });
  }
  const outside: OutsideCounts = { CAFETERIA: {}, BOARD: {} };
  for (const row of data.countsOutsideMonth ?? []) {
    outside[row.dutyType][row.personId] = row.count;
  }
  return { assignments, outside };
}

export function DutyAdminEditor({
  members,
  currentUserId,
  initialMonth,
  minMonth,
  maxMonth,
}: {
  members: Member[];
  currentUserId: string;
  initialMonth: string;
  minMonth: string;
  maxMonth: string;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [assignments, setAssignments] = useState<Record<string, Entry[]>>({});
  // Turns each person has in every month EXCEPT the open one. Added to the
  // live in-month assignments below, so the counter is all-time.
  const [outsideCounts, setOutsideCounts] = useState<OutsideCounts>({ CAFETERIA: {}, BOARD: {} });
  const [loading, setLoading] = useState(true);
  // Bumped to re-read the month from the server - after a failed load (retry)
  // or a failed save, where the optimistic list no longer matches the DB.
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState<"load" | "save" | null>(null);
  const [cell, setCell] = useState<Cell | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Every write goes through one promise chain, so two quick taps can never
  // land out of order.
  const saveChain = useRef<Promise<unknown>>(Promise.resolve());
  // Writes in flight. A background re-sync never applies while this is
  // non-zero, or it would overwrite an optimistic tick with older server data.
  const pendingWrites = useRef(0);
  // Bumped when a write starts. A re-sync GET sent before a PATCH can be read
  // before the PATCH commits yet arrive after it finished (pendingWrites is 0
  // again by then), so the re-sync also drops its answer if this moved.
  const writeSeq = useRef(0);
  const monthRef = useRef(month);
  useEffect(() => {
    monthRef.current = month;
  }, [month]);

  useEffect(() => {
    let stale = false;
    // Queued behind pending saves: a read that overtakes an in-flight write
    // (switch month and back mid-save) returns the old roster for the cell.
    saveChain.current
      .then(() => fetch(`/api/schedule/admin/duty?month=${month}`))
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: MonthResponse) => {
        if (stale) return;
        const parsed = parseMonth(data);
        setAssignments(parsed.assignments);
        setOutsideCounts(parsed.outside);
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

  // Background re-sync, no loading veil: two people filling the same month see
  // each other's work without pressing «Оновити». Runs on focus, when the tab
  // becomes visible again, and once a minute while it is visible.
  useEffect(() => {
    let cancelled = false;
    async function resync() {
      if (document.visibilityState === "hidden" || pendingWrites.current > 0) return;
      const requested = month;
      const seqAtStart = writeSeq.current;
      try {
        const res = await fetch(`/api/schedule/admin/duty?month=${requested}`);
        if (!res.ok) return;
        const data: MonthResponse = await res.json();
        // Drop the answer if a write started, or the month changed, meanwhile.
        if (
          cancelled ||
          pendingWrites.current > 0 ||
          writeSeq.current !== seqAtStart ||
          monthRef.current !== requested
        ) {
          return;
        }
        const parsed = parseMonth(data);
        setAssignments(parsed.assignments);
        setOutsideCounts(parsed.outside);
      } catch {
        // A missed background refresh is invisible by design; the next one retries.
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === "visible") void resync();
    };
    const onFocus = () => void resync();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(() => void resync(), RESYNC_INTERVAL_MS);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, [month]);

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

  // All-time: every month in the DB (outside the open one, from the server) plus
  // the live in-month assignments, so a tick moves the number instantly.
  const counts = useMemo(() => {
    const perType: Record<DutyType, Record<string, number>> = {
      CAFETERIA: { ...outsideCounts.CAFETERIA },
      BOARD: { ...outsideCounts.BOARD },
    };
    for (const [key, entries] of Object.entries(assignments)) {
      const dutyType = key.split("|")[1] as DutyType;
      for (const { personId } of entries) {
        perType[dutyType][personId] = (perType[dutyType][personId] ?? 0) + 1;
      }
    }
    const total: Record<string, number> = {};
    for (const type of Object.values(perType)) {
      for (const [id, n] of Object.entries(type)) total[id] = (total[id] ?? 0) + n;
    }
    return { perType, total };
  }, [assignments, outsideCounts]);

  // The two chips describe the open month's load; the untouched chip is all-time.
  const summary = useMemo(() => {
    let cafeteria = 0;
    let board = 0;
    for (const [key, entries] of Object.entries(assignments)) {
      if (key.endsWith("|CAFETERIA")) cafeteria += entries.length;
      else board += entries.length;
    }
    const untouched = members.filter((m) => !counts.total[m.id]).length;
    return { cafeteria, board, untouched };
  }, [assignments, members, counts]);

  function write(date: string, dutyType: DutyType, change: { add?: string[]; remove?: string[] }) {
    const key = cellKey(date, dutyType);
    setError((current) => (current === "save" ? null : current));
    setAssignments((prev) => {
      const current = prev[key] ?? [];
      const removeSet = new Set(change.remove ?? []);
      const kept = current.filter((e) => !removeSet.has(e.personId));
      const added = (change.add ?? [])
        .filter((id) => !kept.some((e) => e.personId === id))
        .map((personId) => ({ personId, createdById: currentUserId }));
      return { ...prev, [key]: [...kept, ...added] };
    });
    pendingWrites.current += 1;
    writeSeq.current += 1;
    saveChain.current = saveChain.current.then(() =>
      fetch("/api/schedule/admin/duty", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, dutyType, ...change }),
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data: { people: Entry[] } = await res.json();
          pendingWrites.current -= 1;
          // The answer is the authoritative cell, including names other editors
          // added. Only the last queued write applies it: an earlier answer
          // would overwrite the optimistic state of the writes still waiting.
          if (pendingWrites.current === 0) {
            setAssignments((prev) => ({ ...prev, [key]: data.people }));
          }
        })
        .catch(() => {
          pendingWrites.current -= 1;
          // Say so, and put the real roster back on screen instead of leaving a
          // tick the server never stored.
          setError("save");
          reload();
        }),
    );
  }

  const setPerson = (date: string, dutyType: DutyType, personId: string, on: boolean) =>
    write(date, dutyType, on ? { add: [personId] } : { remove: [personId] });

  // «Прибрати всіх» removes the names this editor can see, not "the cell": a
  // name someone else added a second ago must not be deleted unseen.
  const clearCell = (date: string, dutyType: DutyType) =>
    write(date, dutyType, { remove: peopleIn(date, dutyType) });

  function peopleIn(date: string, dutyType: DutyType): string[] {
    return (assignments[cellKey(date, dutyType)] ?? []).map((e) => e.personId);
  }

  function nameOf(personId: string): string {
    const member = members.find((m) => m.id === personId);
    return member ? `${member.lastName} ${member.firstName[0]}.` : "Невідомо";
  }

  // For the open cell: who else assigned each selected person, so an editor can
  // tell before removing a name they did not put there.
  const assignedBy = useMemo(() => {
    const out: Record<string, string> = {};
    if (!cell) return out;
    for (const entry of assignments[cellKey(cell.date, cell.dutyType)] ?? []) {
      if (entry.createdById === currentUserId) continue;
      const editor = members.find((m) => m.id === entry.createdById);
      out[entry.personId] = editor ? `${editor.lastName} ${editor.firstName[0]}.` : "Невідомо";
    }
    return out;
  }, [cell, assignments, members, currentUserId]);

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
          <span className="text-[11px] text-ink-muted">за місяць</span>
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

      {/* Inert until the month has loaded: a cell tapped before that would
          show an empty roster and hide the names already stored in it. */}
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
          counts={counts.perType[cell.dutyType]}
          assignedBy={assignedBy}
          saveFailed={error === "save"}
          onToggle={(personId) =>
            setPerson(
              cell.date,
              cell.dutyType,
              personId,
              !peopleIn(cell.date, cell.dutyType).includes(personId),
            )
          }
          onClearAll={() => clearCell(cell.date, cell.dutyType)}
        />
      )}
    </div>
  );
}
