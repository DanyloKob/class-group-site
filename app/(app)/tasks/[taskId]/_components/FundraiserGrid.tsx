"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, Circle, ChatCircleText, DotsThreeVertical } from "@phosphor-icons/react";
import { PaymentStatusSheet } from "@/app/(app)/tasks/[taskId]/_components/PaymentStatusSheet";

type Status = "UNPAID" | "PAID" | "PAID_WITH_NOTE";
type RosterRow = {
  userId: string;
  firstName: string;
  lastName: string;
  status: Status;
  note: string | null;
};

export function FundraiserGrid({ taskId }: { taskId: string }) {
  const [roster, setRoster] = useState<RosterRow[] | null>(null);
  const [sheetRow, setSheetRow] = useState<RosterRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/tasks/${taskId}/fundraiser`)
      .then((res) => res.json())
      .then((data) => setRoster(data.roster));
  }, [taskId]);

  function updateRow(userId: string, status: Status, note: string | null) {
    setRoster((prev) => prev?.map((r) => (r.userId === userId ? { ...r, status, note } : r)) ?? null);
  }

  function openSheetFor(row: RosterRow) {
    setSheetRow(row);
    setSheetOpen(true);
  }

  async function handleRowTap(row: RosterRow) {
    if (pendingUserId) return; // this row's own request already in flight
    // PAID_WITH_NOTE is never touched by a plain tap - only the sheet can
    // change or clear a note, so a blind tap can't destroy it.
    if (row.status === "PAID_WITH_NOTE") {
      openSheetFor(row);
      return;
    }
    setPendingUserId(row.userId);
    try {
      if (row.status === "UNPAID") {
        updateRow(row.userId, "PAID", null);
        await fetch(`/api/tasks/${taskId}/fundraiser/${row.userId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "PAID" }),
        });
      } else {
        updateRow(row.userId, "UNPAID", null);
        await fetch(`/api/tasks/${taskId}/fundraiser/${row.userId}`, { method: "DELETE" });
      }
    } finally {
      setPendingUserId(null);
    }
  }

  if (!roster) {
    return <p className="px-5 py-4 text-xs text-ink-muted">Завантаження...</p>;
  }

  const paidCount = roster.filter((r) => r.status !== "UNPAID").length;

  return (
    <div className="flex flex-col gap-2 px-5 pb-6">
      <p className="px-1 text-xs text-ink-muted">
        {paidCount}/{roster.length} здали
      </p>
      <div className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl bg-surface">
        {roster.map((row) => {
          const paid = row.status !== "UNPAID";
          return (
            <div key={row.userId} className="flex items-center pr-1">
              <button
                type="button"
                onClick={() => handleRowTap(row)}
                disabled={pendingUserId === row.userId}
                className="flex flex-1 items-center gap-3 px-4 py-3 text-left transition-opacity active:opacity-60 disabled:opacity-50"
              >
                <motion.span
                  key={row.status}
                  initial={{ scale: 0.7, opacity: 0.5 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                >
                  {paid ? (
                    <CheckCircle size={20} weight="fill" className="text-success" />
                  ) : (
                    <Circle size={20} className="text-ink-muted" />
                  )}
                </motion.span>
                <span className="flex-1 text-sm">
                  {row.lastName} {row.firstName}
                </span>
                {row.note && <ChatCircleText size={14} className="text-ink-muted" />}
              </button>
              <div className="h-6 w-px shrink-0 bg-border" />
              <button
                type="button"
                onClick={() => openSheetFor(row)}
                className="flex h-11 w-11 shrink-0 items-center justify-center text-ink-muted transition-transform active:scale-90"
              >
                <DotsThreeVertical size={18} />
              </button>
            </div>
          );
        })}
      </div>

      {sheetRow && (
        <PaymentStatusSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          taskId={taskId}
          userId={sheetRow.userId}
          memberName={`${sheetRow.lastName} ${sheetRow.firstName}`}
          initialStatus={sheetRow.status}
          initialNote={sheetRow.note}
          onSaved={(status, note) => updateRow(sheetRow.userId, status, note)}
        />
      )}
    </div>
  );
}
