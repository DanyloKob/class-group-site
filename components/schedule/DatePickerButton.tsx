"use client";

import { useState } from "react";
import { CalendarBlank, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { BottomSheet } from "@/components/shared/BottomSheet";
import { isSameDay, type DateBounds } from "@/lib/schedule/dateRange";

const MONTH_NAMES = [
  "Січень",
  "Лютий",
  "Березень",
  "Квітень",
  "Травень",
  "Червень",
  "Липень",
  "Серпень",
  "Вересень",
  "Жовтень",
  "Листопад",
  "Грудень",
];
const WEEKDAY_HEADERS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

function buildMonthGrid(year: number, month: number): (Date | null)[] {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = Array(startOffset).fill(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));
  return cells;
}

export function DatePickerButton({
  selected,
  onSelect,
  bounds,
}: {
  selected: Date;
  onSelect: (date: Date) => void;
  bounds?: DateBounds;
}) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(selected.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected.getMonth());

  function openSheet() {
    setViewYear(selected.getFullYear());
    setViewMonth(selected.getMonth());
    setOpen(true);
  }

  // Always day=1: adding a month never lands on a day that doesn't exist in
  // the target month (the classic "Jan 31 + 1 month = Mar 3" trap), since a
  // 1st always exists everywhere.
  function shiftMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  const atMinMonth = bounds && viewYear === bounds.min.getFullYear() && viewMonth === bounds.min.getMonth();
  const atMaxMonth = bounds && viewYear === bounds.max.getFullYear() && viewMonth === bounds.max.getMonth();

  const cells = buildMonthGrid(viewYear, viewMonth);

  return (
    <>
      <button type="button" onClick={openSheet} className="flex h-9 w-9 items-center justify-center rounded-full bg-surface">
        <CalendarBlank size={18} />
      </button>

      <BottomSheet open={open} onOpenChange={setOpen} title={`${MONTH_NAMES[viewMonth]} ${viewYear}`}>
        <div className="flex items-center justify-between pb-3">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            disabled={atMinMonth}
            className="rounded-full p-2 text-ink-muted disabled:opacity-30"
          >
            <CaretLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            disabled={atMaxMonth}
            className="rounded-full p-2 text-ink-muted disabled:opacity-30"
          >
            <CaretRight size={16} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAY_HEADERS.map((h) => (
            <div key={h} className="py-1 text-[11px] text-ink-muted">
              {h}
            </div>
          ))}
          {cells.map((cell, i) => {
            if (!cell) return <div key={`empty-${i}`} />;
            const active = isSameDay(cell, selected);
            const outOfBounds = bounds && (cell < bounds.min || cell > bounds.max);
            return (
              <button
                key={cell.toISOString()}
                type="button"
                disabled={outOfBounds}
                onClick={() => {
                  onSelect(cell);
                  setOpen(false);
                }}
                className={`aspect-square rounded-lg text-sm ${active ? "bg-ink text-background" : outOfBounds ? "text-ink-muted opacity-30" : "text-ink"}`}
              >
                {cell.getDate()}
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </>
  );
}
