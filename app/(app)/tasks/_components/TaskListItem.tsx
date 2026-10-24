"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle, Circle, Wallet, CaretRight } from "@phosphor-icons/react";
import { formatEventDate } from "@/lib/formatDate";
import type { TaskFeedItem } from "@/lib/server/tasks";

export function TaskListItem({ task }: { task: TaskFeedItem }) {
  const isPlain = task.type === "PLAIN";
  const done = isPlain ? task.myDone : task.myStatus !== "UNPAID";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.3 }}
    >
      <Link
        href={`/tasks/${task.id}`}
        className="flex items-center gap-3 rounded-2xl bg-surface p-4 transition-transform active:scale-[0.98]"
      >
        <div className="shrink-0">
          {isPlain ? (
            done ? (
              <CheckCircle size={22} weight="fill" className="text-success" />
            ) : (
              <Circle size={22} className="text-ink-muted" />
            )
          ) : (
            <Wallet size={22} className={done ? "text-success" : "text-ink-muted"} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm font-medium ${done && isPlain ? "text-ink-muted line-through" : ""}`}>
            {task.title}
          </p>
          <p className="text-xs text-ink-muted">
            {task.progressDone}/{task.progressTotal} {isPlain ? "виконали" : "здали"}
            {task.dueDate && ` · ${formatEventDate(task.dueDate)}`}
          </p>
        </div>

        <CaretRight size={16} className="shrink-0 text-ink-muted" />
      </Link>
    </motion.div>
  );
}
