"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, PaperPlaneTilt } from "@phosphor-icons/react";
import { MemberFormSheet, type Member } from "@/app/(app)/account/members/MemberFormSheet";
import { permissionSummaryLabel } from "@/lib/permissions";

export function MembersManager({ initialMembers }: { initialMembers: Member[] }) {
  const [members, setMembers] = useState(initialMembers);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  async function refresh() {
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const data = await res.json();
      setMembers(data.users);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-center justify-between px-5 pb-2 pt-6">
        <div className="flex items-center gap-3">
          <Link href="/account" className="flex h-8 w-8 items-center justify-center rounded-full bg-surface">
            <ArrowLeft size={16} />
          </Link>
          <h1 className="text-lg font-semibold">Учасники</h1>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingMember(null);
            setSheetOpen(true);
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-background transition-transform active:scale-90"
        >
          <Plus size={18} weight="bold" />
        </button>
      </div>

      <div className="flex flex-col gap-2 px-5 pb-6">
        {members.map((member) => (
          <button
            key={member.id}
            type="button"
            onClick={() => {
              setEditingMember(member);
              setSheetOpen(true);
            }}
            className="flex items-center justify-between rounded-2xl bg-surface p-3.5 text-left transition-transform active:scale-[0.98]"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {member.lastName} {member.firstName}
              </p>
              <p className="truncate text-xs text-ink-muted">
                {member.phone} · {permissionSummaryLabel(member)}
              </p>
            </div>
            {member.hasTelegramLink && <PaperPlaneTilt size={16} className="shrink-0 text-success" />}
          </button>
        ))}
      </div>

      <MemberFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editingMember={editingMember}
        onSaved={refresh}
      />
    </div>
  );
}
