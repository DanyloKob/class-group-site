"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/shared/BottomSheet";
import { LikeButton } from "@/components/shared/LikeButton";
import { DeleteConfirmButton } from "@/components/shared/DeleteConfirmButton";
import { PencilSimple } from "@phosphor-icons/react";
import type { ClassGroupScope } from "@/lib/generated/prisma/enums";

type HomeworkEntry = {
  id: string;
  text: string;
  author: { id: string; firstName: string; lastName: string };
  likeCount: number;
  likedByMe: boolean;
  isMine: boolean;
};

export function HomeworkPanel({
  open,
  onOpenChange,
  date,
  slot,
  scope,
  subjectLabel,
  entries,
  canManage,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  slot: number;
  scope: ClassGroupScope;
  subjectLabel: string;
  entries: HomeworkEntry[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submitNew() {
    if (!draft.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/schedule/homework", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, slot, scope, text: draft.trim() }),
      });
      if (res.ok) {
        setDraft("");
        onChanged();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function submitEdit(id: string) {
    if (!editDraft.trim() || submitting) return;
    setSubmitting(true);
    try {
      await fetch(`/api/schedule/homework/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: editDraft.trim() }),
      });
      setEditingId(null);
      onChanged();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/schedule/homework/${id}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={subjectLabel ? `ДЗ · ${subjectLabel}` : "ДЗ"}>
      <div className="flex flex-col gap-3">
        {entries.length === 0 && <p className="py-2 text-xs text-ink-muted">Ще ніхто не написав домашку.</p>}

        {entries.map((entry) =>
          editingId === entry.id ? (
            <div key={entry.id} className="flex flex-col gap-2 rounded-xl bg-surface p-3">
              <textarea
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                rows={2}
                className="resize-none rounded-lg bg-surface-elevated px-2.5 py-2 text-sm outline-none"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => submitEdit(entry.id)}
                  disabled={submitting || !editDraft.trim()}
                  className="rounded-full bg-ink px-3 py-2 text-xs font-medium text-background transition-transform active:scale-95 disabled:opacity-40"
                >
                  Зберегти
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="rounded-full px-3 py-2 text-xs text-ink-muted transition-opacity active:opacity-60"
                >
                  Скасувати
                </button>
              </div>
            </div>
          ) : (
            <div key={entry.id} className="flex flex-col gap-1.5 rounded-xl bg-surface p-3">
              <p className="whitespace-pre-wrap break-words text-sm">{entry.text}</p>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-ink-muted">
                  {entry.author.firstName} {entry.author.lastName}
                </span>
                <div className="flex items-center gap-1">
                  <LikeButton
                    feature="homework"
                    id={entry.id}
                    initialLiked={entry.likedByMe}
                    initialCount={entry.likeCount}
                    disabled={entry.isMine}
                    size={13}
                  />
                  {entry.isMine && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(entry.id);
                        setEditDraft(entry.text);
                      }}
                      className="flex h-10 w-10 items-center justify-center text-ink-muted transition-transform active:scale-90"
                    >
                      <PencilSimple size={14} />
                    </button>
                  )}
                  {(entry.isMine || canManage) && (
                    <DeleteConfirmButton onConfirm={() => handleDelete(entry.id)} label="" />
                  )}
                </div>
              </div>
            </div>
          ),
        )}

        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder="Написати домашку..."
            className="resize-none rounded-xl bg-surface px-3 py-2.5 text-sm outline-none ring-accent focus:ring-2"
          />
          <button
            type="button"
            onClick={submitNew}
            disabled={!draft.trim() || submitting}
            className="rounded-full bg-ink py-2.5 text-sm font-medium text-background transition-transform active:scale-[0.98] disabled:opacity-40"
          >
            Додати
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
