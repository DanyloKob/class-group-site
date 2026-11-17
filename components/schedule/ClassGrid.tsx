"use client";

import { ClassCard } from "@/components/schedule/ClassCard";
import type { ResolvedDaySlot } from "@/lib/server/schedule";

export function ClassGrid({ slots }: { slots: ResolvedDaySlot[] }) {
  if (slots.length === 0) {
    return <p className="px-5 text-center text-xs text-ink-muted">Пар не заплановано.</p>;
  }

  return (
    <div className="flex flex-col gap-2 px-5">
      {slots.map((row) => (
        <div key={row.slot} className={`grid gap-2 ${row.merged ? "grid-cols-1" : "grid-cols-2"}`}>
          {row.merged ? (
            <ClassCard content={row.a} />
          ) : (
            <>
              <ClassCard content={row.a} />
              <ClassCard content={row.b} />
            </>
          )}
        </div>
      ))}
    </div>
  );
}
