import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getTaskDetail } from "@/lib/server/tasks";
import { canManageTasks } from "@/lib/permissions";
import { PlainTaskDetail } from "@/app/(app)/tasks/[taskId]/_components/PlainTaskDetail";
import { FundraiserTaskDetail } from "@/app/(app)/tasks/[taskId]/_components/FundraiserTaskDetail";

export default async function TaskDetailPage({ params }: { params: Promise<{ taskId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { taskId } = await params;
  const task = await getTaskDetail(taskId, user.id);
  if (!task) notFound();

  const canManage = canManageTasks(user);

  return task.type === "PLAIN" ? (
    <PlainTaskDetail task={task} canManage={canManage} />
  ) : (
    <FundraiserTaskDetail task={task} canManage={canManage} />
  );
}
