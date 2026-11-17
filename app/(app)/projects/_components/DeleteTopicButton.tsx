"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DeleteConfirmButton } from "@/components/shared/DeleteConfirmButton";

export function DeleteTopicButton({ topicId }: { topicId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  async function remove() {
    setMessage(null);
    try {
      const res = await fetch(`/api/projects/topics/${topicId}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/projects");
        router.refresh();
        return;
      }
      if (res.status === 409) {
        setMessage("У темі є матеріали інших учасників. Видалити її може адміністратор.");
        return;
      }
      setMessage("Не вдалося видалити тему.");
    } catch {
      setMessage("Не вдалося видалити тему.");
    }
  }

  return (
    <div className="relative">
      <DeleteConfirmButton onConfirm={remove} />
      {message && (
        <p role="alert" className="absolute right-0 top-full z-20 mt-1 w-64 rounded-xl bg-surface-elevated px-3 py-2 text-xs text-ink-muted shadow-lg">
          {message}
        </p>
      )}
    </div>
  );
}
