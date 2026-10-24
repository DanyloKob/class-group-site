"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Flask } from "@phosphor-icons/react";
import { permissionSummaryLabel } from "@/lib/permissions";

type DevUser = {
  id: string;
  firstName: string;
  lastName: string;
  isSuperAdmin: boolean;
  canManageTasks: boolean;
  canManageNews: boolean;
  canManageSchedule: boolean;
  canManageDuty: boolean;
  canPostMemories: boolean;
};

export function DevLoginPicker() {
  const router = useRouter();
  const [users, setUsers] = useState<DevUser[]>([]);

  useEffect(() => {
    fetch("/api/auth/dev-login/users")
      .then((res) => res.json())
      .then((data) => setUsers(data.users ?? []));
  }, []);

  async function loginAs(userId: string) {
    await fetch("/api/auth/dev-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    router.push("/tasks");
  }

  if (users.length === 0) return null;

  return (
    <div className="mt-6 flex w-full max-w-[280px] flex-col gap-2 rounded-2xl border border-dashed border-border p-4">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink-muted">
        <Flask size={13} />
        Dev-вхід (лише локально)
      </div>
      {users.map((u) => (
        <button
          key={u.id}
          type="button"
          onClick={() => loginAs(u.id)}
          className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 text-left text-sm transition-transform active:scale-[0.98]"
        >
          <span>
            {u.lastName} {u.firstName}
          </span>
          <span className="text-xs text-ink-muted">{permissionSummaryLabel(u)}</span>
        </button>
      ))}
    </div>
  );
}
