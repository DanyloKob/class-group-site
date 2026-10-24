import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getTaskFeed } from "@/lib/server/tasks";
import { canManageTasks } from "@/lib/permissions";
import { TasksFeed } from "@/app/(app)/tasks/_components/TasksFeed";

export default async function TasksPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const tasks = await getTaskFeed(user);

  return <TasksFeed initialTasks={tasks} canCreate={canManageTasks(user)} />;
}
