"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react";
import { DeleteConfirmButton } from "@/components/shared/DeleteConfirmButton";
import { formatEventDate } from "@/lib/formatDate";

export function TaskDetailHeader({
  taskId,
  title,
  description,
  dueDate,
  canManage,
}: {
  taskId: string;
  title: string;
  description: string | null;
  dueDate: Date | string | null;
  canManage: boolean;
}) {
  const router = useRouter();

  async function handleDelete() {
    await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    router.push("/tasks");
  }

  return (
    <div className="flex flex-col gap-3 px-5 pb-4 pt-6">
      <div className="flex items-center justify-between">
        <Link href="/tasks" className="flex h-8 w-8 items-center justify-center rounded-full bg-surface">
          <ArrowLeft size={16} />
        </Link>
        {canManage && <DeleteConfirmButton onConfirm={handleDelete} />}
      </div>
      <div>
        <h1 className="text-lg font-semibold leading-snug">{title}</h1>
        {dueDate && <p className="mt-0.5 text-xs text-ink-muted">Дедлайн: {formatEventDate(dueDate)}</p>}
      </div>
      {description && <p className="whitespace-pre-wrap break-words text-sm text-ink-muted">{description}</p>}
    </div>
  );
}
