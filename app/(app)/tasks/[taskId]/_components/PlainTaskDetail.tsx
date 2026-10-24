import { TaskDetailHeader } from "@/app/(app)/tasks/[taskId]/_components/TaskDetailHeader";
import { DoneButton } from "@/app/(app)/tasks/[taskId]/_components/DoneButton";
import { CompletionRosterList } from "@/app/(app)/tasks/[taskId]/_components/CompletionRosterList";
import type { TaskDetail } from "@/lib/server/tasks";

export function PlainTaskDetail({ task, canManage }: { task: TaskDetail; canManage: boolean }) {
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <TaskDetailHeader
        taskId={task.id}
        title={task.title}
        description={task.description}
        dueDate={task.dueDate}
        canManage={canManage}
      />
      <div className="px-5 pb-6">
        <DoneButton taskId={task.id} initialDone={task.myDone} />
        {canManage && <CompletionRosterList taskId={task.id} />}
      </div>
    </div>
  );
}
