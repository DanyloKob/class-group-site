import type { WeekParity } from "@/lib/generated/prisma/enums";

export function WeekParityBadge({ parity }: { parity: WeekParity }) {
  return (
    <span className="whitespace-nowrap rounded-full bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-muted">
      {parity === "NUMERATOR" ? "Чисельник" : "Знаменник"}
    </span>
  );
}
