"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, Circle } from "@phosphor-icons/react";

export function DoneButton({ taskId, initialDone }: { taskId: string; initialDone: boolean }) {
  const [done, setDone] = useState(initialDone);
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (pending) return;
    const next = !done;
    setDone(next);
    setPending(true);
    try {
      await fetch(`/api/tasks/${taskId}/complete`, { method: next ? "POST" : "DELETE" });
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={`flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-70 ${
        done ? "bg-success text-success-ink" : "bg-ink text-background"
      }`}
    >
      <motion.span
        key={done ? "done" : "todo"}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 25 }}
      >
        {done ? <CheckCircle size={18} weight="fill" /> : <Circle size={18} />}
      </motion.span>
      {done ? "Виконано" : "Позначити виконаним"}
    </button>
  );
}
