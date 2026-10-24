"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { BottomSheet } from "@/components/shared/BottomSheet";
import type { ScheduleGroup } from "@/lib/generated/prisma/enums";

export type Member = {
  id: string;
  phone: string;
  lastName: string;
  firstName: string;
  isSuperAdmin: boolean;
  canManageTasks: boolean;
  canManageNews: boolean;
  canManageSchedule: boolean;
  canManageDuty: boolean;
  canPostMemories: boolean;
  scheduleGroup: ScheduleGroup | null;
  hasTelegramLink: boolean;
};

type PermissionKey = "canManageTasks" | "canManageNews" | "canManageSchedule" | "canManageDuty" | "canPostMemories";

// Each label states exactly what the flag grants and nothing more. The duty
// roster used to ride along with the homework flag, which is precisely the
// kind of "label says less than the code does" gap that let the wrong people
// edit it - keep these honest.
const PERMISSION_OPTIONS: { key: PermissionKey; label: string }[] = [
  { key: "canManageTasks", label: "Може робити нагадування та збори" },
  { key: "canManageNews", label: "Може писати оголошення" },
  { key: "canManageSchedule", label: "Може видаляти чуже дз" },
  { key: "canManageDuty", label: "Може призначати чергових" },
  { key: "canPostMemories", label: "Може постити у спогади" },
];

const GROUP_OPTIONS: { value: ScheduleGroup | null; label: string }[] = [
  { value: null, label: "Не вказано" },
  { value: "A", label: "А" },
  { value: "B", label: "Б" },
];

export function MemberFormSheet({
  open,
  onOpenChange,
  editingMember,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingMember: Member | null;
  onSaved: () => void;
}) {
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [canManageTasks, setCanManageTasks] = useState(false);
  const [canManageNews, setCanManageNews] = useState(false);
  const [canManageSchedule, setCanManageSchedule] = useState(false);
  const [canManageDuty, setCanManageDuty] = useState(false);
  const [canPostMemories, setCanPostMemories] = useState(false);
  const [scheduleGroup, setScheduleGroup] = useState<ScheduleGroup | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const permissionState = { canManageTasks, canManageNews, canManageSchedule, canManageDuty, canPostMemories };
  const setPermission: Record<PermissionKey, (v: boolean) => void> = {
    canManageTasks: setCanManageTasks,
    canManageNews: setCanManageNews,
    canManageSchedule: setCanManageSchedule,
    canManageDuty: setCanManageDuty,
    canPostMemories: setCanPostMemories,
  };

  // Reset fields to match editingMember the moment the sheet opens - during
  // render (see CreateNewsSheet.tsx for why not a useEffect).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setLastName(editingMember?.lastName ?? "");
      setFirstName(editingMember?.firstName ?? "");
      setPhone(editingMember?.phone ?? "");
      setCanManageTasks(editingMember?.canManageTasks ?? false);
      setCanManageNews(editingMember?.canManageNews ?? false);
      setCanManageSchedule(editingMember?.canManageSchedule ?? false);
      setCanManageDuty(editingMember?.canManageDuty ?? false);
      setCanPostMemories(editingMember?.canPostMemories ?? false);
      setScheduleGroup(editingMember?.scheduleGroup ?? null);
      setError(null);
    }
  }

  async function submit() {
    if (!lastName.trim() || !firstName.trim() || !phone.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    const payload = {
      lastName: lastName.trim(),
      firstName: firstName.trim(),
      phone: phone.trim(),
      canManageTasks,
      canManageNews,
      canManageSchedule,
      canManageDuty,
      canPostMemories,
      scheduleGroup,
    };
    try {
      const res = editingMember
        ? await fetch(`/api/admin/users/${editingMember.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (res.ok) {
        onOpenChange(false);
        onSaved();
      } else {
        const data = await res.json().catch(() => ({}));
        const messages: Record<string, string> = {
          phone_already_registered: "Цей номер телефону вже зареєстрований.",
        };
        setError(messages[data.error] ?? "Не вдалося зберегти. Перевірте дані.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={editingMember ? "Редагувати учасника" : "Новий учасник"}>
      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label className="text-xs text-ink-muted">Прізвище</label>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="min-w-0 rounded-xl bg-surface px-3 py-2.5 text-sm outline-none ring-accent focus:ring-2"
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label className="text-xs text-ink-muted">Ім&apos;я</label>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="min-w-0 rounded-xl bg-surface px-3 py-2.5 text-sm outline-none ring-accent focus:ring-2"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-ink-muted">Номер телефону</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+380971234567"
            className="rounded-xl bg-surface px-3 py-2.5 text-sm outline-none ring-accent focus:ring-2"
          />
          {editingMember?.hasTelegramLink && (
            <p className="text-[11px] text-ink-muted">
              Прив&apos;язано до Telegram - зміна номера відв&apos;яже, доки людина не увійде знову.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-ink-muted">Група</span>
          <div className="relative flex rounded-xl bg-surface p-1">
            {GROUP_OPTIONS.map((option) => {
              const active = scheduleGroup === option.value;
              return (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setScheduleGroup(option.value)}
                  className="relative z-10 flex-1 rounded-lg py-2 text-xs font-medium"
                >
                  {active && (
                    <motion.div
                      layoutId="member-group-active"
                      className="absolute inset-0 -z-10 rounded-lg bg-ink"
                      transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    />
                  )}
                  <span className={active ? "text-background" : "text-ink-muted"}>{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-ink-muted">Права</span>
          <div className="flex flex-col divide-y divide-border overflow-hidden rounded-xl bg-surface">
            {PERMISSION_OPTIONS.map(({ key, label }) => (
              <label key={key} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <span className="text-sm">{label}</span>
                <input
                  type="checkbox"
                  checked={permissionState[key]}
                  onChange={(e) => setPermission[key](e.target.checked)}
                  className="h-4 w-4 shrink-0 accent-accent"
                />
              </label>
            ))}
          </div>
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}

        <button
          type="button"
          onClick={submit}
          disabled={!lastName.trim() || !firstName.trim() || !phone.trim() || submitting}
          className="rounded-full bg-ink py-3 text-sm font-medium text-background transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          {editingMember ? "Зберегти" : "Зареєструвати"}
        </button>
      </div>
    </BottomSheet>
  );
}
