"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { GearSix } from "@phosphor-icons/react";
import Link from "next/link";
import { DaySwiper } from "@/components/schedule/DaySwiper";
import { DatePickerButton } from "@/components/schedule/DatePickerButton";
import { WeekParityBadge } from "@/components/schedule/WeekParityBadge";
import { DutySection } from "@/components/schedule/DutySection";
import { ClassGrid } from "@/components/schedule/ClassGrid";
import { toDateParam, fromDateParam, stepWeekday } from "@/lib/schedule/dateRange";
import { defaultScheduleDate, academicYearRange } from "@/lib/schedule/parity";
import type { DaySchedule } from "@/lib/server/schedule";

export function ScheduleDayView({
  initialDateParam,
  initialSchedule,
  initialCanModerate,
  initialCanOpenAdmin,
}: {
  initialDateParam: string;
  initialSchedule: DaySchedule;
  /** Deleting other people's homework. */
  initialCanModerate: boolean;
  /** Whether the gear leads anywhere - duty manager or superadmin. */
  initialCanOpenAdmin: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [dateParam, setDateParam] = useState(initialDateParam);
  const [schedule, setSchedule] = useState(initialSchedule);
  const [canModerate, setCanModerate] = useState(initialCanModerate);
  const [canOpenAdmin, setCanOpenAdmin] = useState(initialCanOpenAdmin);
  const [direction, setDirection] = useState(0);

  // Fast day-swiping can let an earlier, slower response resolve after a
  // later, faster one - only the response matching the most recently
  // requested date is applied, so the UI can't briefly show the wrong day.
  const latestRequestedDate = useRef(dateParam);

  const fetchDay = useCallback(async (nextDateParam: string) => {
    latestRequestedDate.current = nextDateParam;
    const res = await fetch(`/api/schedule/day?date=${nextDateParam}`);
    if (!res.ok) return;
    const data = await res.json();
    if (latestRequestedDate.current !== nextDateParam) return; // superseded by a newer request
    setSchedule(data.schedule);
    setCanModerate(data.canModerate);
    setCanOpenAdmin(data.canOpenAdmin);
  }, []);

  // Tracks whether the visible date is still "whatever today is" (the
  // default on arrival) versus a date the person deliberately browsed to -
  // any manual navigation (goTo) turns this off for the rest of the visit,
  // so auto-follow never yanks someone away from a day they chose to look
  // at. A ref, not state: it's read/written from event handlers, never
  // needs to trigger a render on its own.
  const isAutoToday = useRef(true);

  // A phone left on the schedule tab across midnight (or a stale
  // client-router-cache render from an earlier visit) must still end up on
  // the real "today" the next time it's actually looked at - re-check
  // whenever the tab/PWA regains visibility, not just once at mount.
  useEffect(() => {
    function syncToToday() {
      if (!isAutoToday.current || document.visibilityState === "hidden") return;
      const fresh = defaultScheduleDate();
      setDateParam((current) => {
        if (current === fresh) return current;
        fetchDay(fresh);
        return fresh;
      });
    }
    syncToToday();
    document.addEventListener("visibilitychange", syncToToday);
    window.addEventListener("focus", syncToToday);
    return () => {
      document.removeEventListener("visibilitychange", syncToToday);
      window.removeEventListener("focus", syncToToday);
    };
  }, [fetchDay]);

  // Reflect the current date in the URL (shareable, browser-back-friendly)
  // without a full server round-trip - fetchDay does the actual data load.
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    params.set("date", dateParam);
    router.replace(`?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateParam]);

  function goTo(nextDate: Date, dir: number) {
    isAutoToday.current = false;
    setDirection(dir);
    const param = toDateParam(nextDate);
    setDateParam(param);
    fetchDay(param);
  }

  const selectedDate = fromDateParam(dateParam);
  const { start, end } = academicYearRange(dateParam);
  const bounds = { min: fromDateParam(start), max: fromDateParam(end) };

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-center justify-between gap-2 px-5 pb-2 pt-6">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Розклад</h1>
          <WeekParityBadge parity={schedule.parity} />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canOpenAdmin && (
            <Link href="/schedule/admin" className="flex h-9 w-9 items-center justify-center rounded-full bg-surface">
              <GearSix size={18} />
            </Link>
          )}
          <DatePickerButton selected={selectedDate} onSelect={(d) => goTo(d, 0)} bounds={bounds} />
        </div>
      </div>

      <DaySwiper selected={selectedDate} onSelect={(d) => goTo(d, d > selectedDate ? 1 : -1)} bounds={bounds} />

      <div className="mt-3 flex items-center justify-between px-5 text-xs text-ink-muted">
        <span>Група А</span>
        <span>Група Б</span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={dateParam}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragEnd={(_e, info) => {
            if (info.offset.x < -60) {
              const next = stepWeekday(selectedDate, 1, bounds);
              if (next) goTo(next, 1);
            } else if (info.offset.x > 60) {
              const prev = stepWeekday(selectedDate, -1, bounds);
              if (prev) goTo(prev, -1);
            }
          }}
          initial={{ opacity: 0, x: direction * 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -24 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          className="mt-2 flex flex-col gap-4"
        >
          <DutySection cafeteria={schedule.cafeteria} board={schedule.board} />
          <ClassGrid
            slots={schedule.slots}
            dateParam={dateParam}
            canManage={canModerate}
            onHomeworkChanged={() => fetchDay(dateParam)}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
