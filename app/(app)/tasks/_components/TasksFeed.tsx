"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Plus, ClipboardText } from "@phosphor-icons/react";
import { TaskListItem } from "@/app/(app)/tasks/_components/TaskListItem";
import { CreateTaskSheet } from "@/app/(app)/tasks/_components/CreateTaskSheet";
import type { TaskFeedItem } from "@/lib/server/tasks";

export function TasksFeed({ initialTasks, canCreate }: { initialTasks: TaskFeedItem[]; canCreate: boolean }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [sheetOpen, setSheetOpen] = useState(false);

  async function refresh() {
    const res = await fetch("/api/tasks");
    if (res.ok) {
      const data = await res.json();
      setTasks(data.tasks);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 pb-2 pt-6">
        <h1 className="text-xl font-semibold tracking-tight">Завдання</h1>
        {canCreate && (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-background transition-transform active:scale-90"
          >
            <Plus size={18} weight="bold" />
          </button>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <ClipboardText size={32} className="text-ink-muted" />
          <p className="text-sm text-ink-muted">Завдань поки немає.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 overflow-y-auto px-5 pb-6">
          <AnimatePresence initial={false}>
            {tasks.map((task) => (
              <TaskListItem key={task.id} task={task} />
            ))}
          </AnimatePresence>
        </div>
      )}

      <CreateTaskSheet open={sheetOpen} onOpenChange={setSheetOpen} onCreated={refresh} />
    </div>
  );
}
