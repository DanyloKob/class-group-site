"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { BottomSheet } from "@/components/shared/BottomSheet";

export function CreateTaskSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [type, setType] = useState<"PLAIN" | "FUNDRAISER">("PLAIN");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [hasDueDate, setHasDueDate] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setType("PLAIN");
    setTitle("");
    setDescription("");
    setHasDueDate(false);
    setDueDate("");
  }

  async function submit() {
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: title.trim(),
          description: description.trim() || null,
          dueDate: hasDueDate && dueDate ? new Date(dueDate).toISOString() : null,
        }),
      });
      if (res.ok) {
        onOpenChange(false);
        reset();
        onCreated();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="Нове завдання">
      <div className="flex flex-col gap-4">
        <div className="relative flex rounded-full bg-surface p-1">
          {(["PLAIN", "FUNDRAISER"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setType(option)}
              className="relative z-10 flex-1 rounded-full py-2 text-sm font-medium"
            >
              {type === option && (
                <motion.div
                  layoutId="task-type-active"
                  className="absolute inset-0 -z-10 rounded-full bg-ink"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <span className={type === option ? "text-background" : "text-ink-muted"}>
                {option === "PLAIN" ? "Нагадування" : "Збір коштів"}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-ink-muted" htmlFor="task-title">
            Назва
          </label>
          <input
            id="task-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-xl bg-surface px-3 py-2.5 text-sm outline-none ring-accent focus:ring-2"
            placeholder={type === "PLAIN" ? "Наприклад: Принести зошити" : "Наприклад: На букет наставниці"}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-ink-muted" htmlFor="task-description">
            Опис {type === "FUNDRAISER" && "(сума, реквізити тощо)"}
          </label>
          <textarea
            id="task-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="resize-none rounded-xl bg-surface px-3 py-2.5 text-sm outline-none ring-accent focus:ring-2"
          />
        </div>

        <label className="flex items-center justify-between rounded-xl bg-surface px-3 py-2.5">
          <span className="text-sm">Є дедлайн</span>
          <input
            type="checkbox"
            checked={hasDueDate}
            onChange={(e) => setHasDueDate(e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
        </label>

        {hasDueDate && (
          <input
            type="datetime-local"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded-xl bg-surface px-3 py-2.5 text-sm outline-none ring-accent focus:ring-2"
          />
        )}

        <button
          type="button"
          onClick={submit}
          disabled={!title.trim() || submitting}
          className="mt-2 rounded-full bg-ink py-3 text-sm font-medium text-background transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          Створити
        </button>
      </div>
    </BottomSheet>
  );
}
