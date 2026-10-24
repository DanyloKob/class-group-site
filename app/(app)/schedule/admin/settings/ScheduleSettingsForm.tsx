"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, WarningCircle } from "@phosphor-icons/react";
import type { WeekParity } from "@/lib/generated/prisma/enums";

export function ScheduleSettingsForm({
  initialAnchorDate,
  initialAnchorType,
}: {
  initialAnchorDate: string;
  initialAnchorType: WeekParity;
}) {
  const [anchorDate, setAnchorDate] = useState(initialAnchorDate);
  const [anchorType, setAnchorType] = useState<WeekParity>(initialAnchorType);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    if (!anchorDate || saving) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/schedule/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parityAnchorDate: anchorDate, parityAnchorType: anchorType }),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 px-5 py-6">
      <div className="flex items-center gap-3">
        <Link href="/schedule/admin" className="flex h-8 w-8 items-center justify-center rounded-full bg-surface">
          <ArrowLeft size={16} />
        </Link>
        <h1 className="text-lg font-semibold">Чисельник/знаменник</h1>
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-danger/10 p-3 text-xs text-danger">
        <WarningCircle size={16} className="mt-0.5 shrink-0" />
        <span>Ця зміна впливає на всі дати, минулі й майбутні одразу - міняйте лише щоб виправити помилку.</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-ink-muted" htmlFor="anchor-date">
          Дата (будь-який день у відомому тижні)
        </label>
        <input
          id="anchor-date"
          type="date"
          value={anchorDate}
          onChange={(e) => setAnchorDate(e.target.value)}
          className="rounded-xl bg-surface px-3 py-2.5 text-sm outline-none ring-accent focus:ring-2"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-ink-muted">Цей тиждень є</span>
        <div className="relative flex rounded-full bg-surface p-1">
          {(["NUMERATOR", "DENOMINATOR"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setAnchorType(option)}
              className="relative z-10 flex-1 rounded-full py-2 text-sm font-medium"
            >
              {anchorType === option && (
                <motion.div
                  layoutId="anchor-type-active"
                  className="absolute inset-0 -z-10 rounded-full bg-ink"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <span className={anchorType === option ? "text-background" : "text-ink-muted"}>
                {option === "NUMERATOR" ? "Чисельником" : "Знаменником"}
              </span>
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={!anchorDate || saving}
        className="rounded-full bg-ink py-3 text-sm font-medium text-background transition-transform active:scale-[0.98] disabled:opacity-40"
      >
        {saved ? "Збережено" : "Зберегти"}
      </button>
    </div>
  );
}
