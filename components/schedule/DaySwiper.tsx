"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { weekdayRange, weekdayShortLabel, isSameDay, type DateBounds } from "@/lib/schedule/dateRange";

export function DaySwiper({
  selected,
  onSelect,
  bounds,
}: {
  selected: Date;
  onSelect: (date: Date) => void;
  bounds?: DateBounds;
}) {
  // Deliberately NOT passing bounds here: the strip always renders a full
  // window either side of `selected` so there's something to scroll past
  // and truly center on, even right at the edge of the school year - only
  // individual out-of-range days are disabled below. Clipping the window
  // itself at the boundary is what pinned the selected day to the strip's
  // edge instead of its middle.
  const days = weekdayRange(selected, 45, 45);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    // Only re-center when the selected day actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.getTime()]);

  return (
    <div ref={scrollerRef} className="flex shrink-0 gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
      {days.map((day) => {
        const active = isSameDay(day, selected);
        const outOfBounds = bounds && (day < bounds.min || day > bounds.max);
        return (
          <button
            key={day.toISOString()}
            ref={active ? selectedRef : undefined}
            type="button"
            disabled={outOfBounds}
            onClick={() => onSelect(day)}
            className={`relative flex shrink-0 flex-col items-center gap-0.5 rounded-xl px-3 py-2 ${outOfBounds ? "opacity-30" : ""}`}
          >
            {active && (
              <motion.div
                layoutId="day-swiper-active"
                className="absolute inset-0 rounded-xl bg-ink"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className={`relative text-[10px] uppercase ${active ? "text-background" : "text-ink-muted"}`}>
              {weekdayShortLabel(day)}
            </span>
            <span className={`relative text-sm font-medium ${active ? "text-background" : "text-ink"}`}>
              {day.getDate()}
            </span>
          </button>
        );
      })}
    </div>
  );
}
