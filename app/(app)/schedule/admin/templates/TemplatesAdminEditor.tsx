"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft } from "@phosphor-icons/react";
import type { Weekday, WeekParity, ClassGroupScope } from "@/lib/generated/prisma/enums";

type TemplateRow = { id: string; slot: number; scope: ClassGroupScope; subject: string; teacher: string; room: string };
type ClassFields = { subject: string; teacher: string; room: string };
const EMPTY_FIELDS: ClassFields = { subject: "", teacher: "", room: "" };

const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: "MONDAY", label: "Пн" },
  { value: "TUESDAY", label: "Вт" },
  { value: "WEDNESDAY", label: "Ср" },
  { value: "THURSDAY", label: "Чт" },
  { value: "FRIDAY", label: "Пт" },
];

function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  layoutId,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  layoutId: string;
}) {
  return (
    <div className="relative flex rounded-full bg-surface p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className="relative z-10 flex-1 whitespace-nowrap rounded-full px-3 py-2 text-xs font-medium"
        >
          {value === opt.value && (
            <motion.div
              layoutId={layoutId}
              className="absolute inset-0 -z-10 rounded-full bg-ink"
              transition={{ type: "spring", stiffness: 500, damping: 40 }}
            />
          )}
          <span className={value === opt.value ? "text-background" : "text-ink-muted"}>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

function ClassFieldsForm({ fields, onChange }: { fields: ClassFields; onChange: (f: ClassFields) => void }) {
  return (
    // Sized by its own width, not the screen: in "Окремо" two of these share
    // one card, and on a 320px phone teacher + a fixed-width room left the
    // teacher field ~36px wide. Below 14rem they stack instead.
    <div className="@container flex flex-col gap-2">
      <input
        value={fields.subject}
        onChange={(e) => onChange({ ...fields, subject: e.target.value })}
        placeholder="Предмет"
        className="rounded-lg bg-surface-elevated px-2.5 py-2 text-sm outline-none"
      />
      <div className="flex flex-col gap-2 @[14rem]:flex-row">
        <input
          value={fields.teacher}
          onChange={(e) => onChange({ ...fields, teacher: e.target.value })}
          placeholder="Викладач"
          className="min-w-0 flex-1 rounded-lg bg-surface-elevated px-2.5 py-2 text-sm outline-none"
        />
        <input
          value={fields.room}
          onChange={(e) => onChange({ ...fields, room: e.target.value })}
          placeholder="Ауд."
          className="rounded-lg bg-surface-elevated px-2.5 py-2 text-sm outline-none @[14rem]:w-20"
        />
      </div>
    </div>
  );
}

function SlotEditor({
  slot,
  weekday,
  parity,
  templates,
  onSaved,
}: {
  slot: number;
  weekday: Weekday;
  parity: WeekParity;
  templates: TemplateRow[];
  onSaved: () => void;
}) {
  const shared = templates.find((t) => t.slot === slot && t.scope === "SHARED");
  const groupA = templates.find((t) => t.slot === slot && t.scope === "A");
  const groupB = templates.find((t) => t.slot === slot && t.scope === "B");

  const [mode, setMode] = useState<"SHARED" | "SPLIT">(shared ? "SHARED" : "SPLIT");
  const [sharedFields, setSharedFields] = useState<ClassFields>(shared ?? EMPTY_FIELDS);
  const [fieldsA, setFieldsA] = useState<ClassFields>(groupA ?? EMPTY_FIELDS);
  const [fieldsB, setFieldsB] = useState<ClassFields>(groupB ?? EMPTY_FIELDS);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const body =
        mode === "SHARED"
          ? { weekday, parity, slot, mode, shared: sharedFields.subject ? sharedFields : null }
          : {
              weekday,
              parity,
              slot,
              mode,
              groupA: fieldsA.subject ? fieldsA : null,
              groupB: fieldsB.subject ? fieldsB : null,
            };
      await fetch("/api/schedule/admin/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-surface p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Пара {slot}</span>
        <SegmentedToggle
          layoutId={`slot-mode-${slot}`}
          value={mode}
          onChange={setMode}
          options={[
            { value: "SHARED", label: "Спільна" },
            { value: "SPLIT", label: "Окремо" },
          ]}
        />
      </div>

      {mode === "SHARED" ? (
        <ClassFieldsForm fields={sharedFields} onChange={setSharedFields} />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-ink-muted">Група А</span>
            <ClassFieldsForm fields={fieldsA} onChange={setFieldsA} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-ink-muted">Група Б</span>
            <ClassFieldsForm fields={fieldsB} onChange={setFieldsB} />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="self-end rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-background disabled:opacity-40"
      >
        Зберегти
      </button>
    </div>
  );
}

export function TemplatesAdminEditor() {
  const [weekday, setWeekday] = useState<Weekday>("MONDAY");
  const [parity, setParity] = useState<WeekParity>("NUMERATOR");
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  // Tracks which (weekday, parity) the current `templates` actually answers,
  // so SlotEditor never mounts and seeds its useState from a stale or empty
  // array while the fetch for a newly-selected day is still in flight.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const requestKey = `${weekday}-${parity}`;
  const loaded = loadedKey === requestKey;

  useEffect(() => {
    // If the admin flips weekday/parity twice quickly, an older request can
    // resolve after a newer one. The cleanup flag makes a stale response a
    // no-op instead of it overwriting fresher data or getting the "loaded"
    // flag stuck on a key that's no longer selected.
    let stale = false;
    fetch(`/api/schedule/admin/templates?weekday=${weekday}&parity=${parity}`)
      .then((res) => res.json())
      .then((data) => {
        if (stale) return;
        setTemplates(data.templates);
        setLoadedKey(`${weekday}-${parity}`);
      });
    return () => {
      stale = true;
    };
  }, [weekday, parity, refreshKey]);

  const slots = useMemo(() => [1, 2, 3, 4], []);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto px-5 py-6">
      <div className="flex items-center gap-3">
        <Link href="/schedule/admin" className="flex h-8 w-8 items-center justify-center rounded-full bg-surface">
          <ArrowLeft size={16} />
        </Link>
        <h1 className="text-lg font-semibold">Розклад пар</h1>
      </div>

      <div className="flex gap-1.5">
        {WEEKDAYS.map((w) => (
          <button
            key={w.value}
            type="button"
            onClick={() => setWeekday(w.value)}
            className="relative z-10 flex-1 rounded-full py-2 text-xs font-medium"
          >
            {weekday === w.value && (
              <motion.div
                layoutId="tpl-weekday-active"
                className="absolute inset-0 -z-10 rounded-full bg-ink"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className={weekday === w.value ? "text-background" : "text-ink-muted"}>{w.label}</span>
          </button>
        ))}
      </div>

      <SegmentedToggle
        layoutId="tpl-parity-active"
        value={parity}
        onChange={setParity}
        options={[
          { value: "NUMERATOR", label: "Чисельник" },
          { value: "DENOMINATOR", label: "Знаменник" },
        ]}
      />

      <div className="flex flex-col gap-3 pb-6">
        {!loaded && <p className="py-4 text-center text-xs text-ink-muted">Завантаження...</p>}
        {loaded &&
          slots.map((slot) => (
            <SlotEditor
              key={`${weekday}-${parity}-${slot}`}
              slot={slot}
              weekday={weekday}
              parity={parity}
              templates={templates}
              onSaved={() => setRefreshKey((k) => k + 1)}
            />
          ))}
      </div>
    </div>
  );
}
