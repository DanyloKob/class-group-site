import { TaskDetailHeader } from "@/app/(app)/tasks/[taskId]/_components/TaskDetailHeader";
import { MyPaymentStatusPill } from "@/app/(app)/tasks/[taskId]/_components/MyPaymentStatusPill";
import { FundraiserGrid } from "@/app/(app)/tasks/[taskId]/_components/FundraiserGrid";
import type { TaskDetail } from "@/lib/server/tasks";

export function FundraiserTaskDetail({ task, canManage }: { task: TaskDetail; canManage: boolean }) {
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <TaskDetailHeader
        taskId={task.id}
        title={task.title}
        description={task.description}
        dueDate={task.dueDate}
        canManage={canManage}
      />
      {canManage ? (
        <FundraiserGrid taskId={task.id} />
      ) : (
        <div className="px-5 pb-6">
          <MyPaymentStatusPill status={task.myStatus} note={task.myNote} />
        </div>
      )}
    </div>
  );
}
