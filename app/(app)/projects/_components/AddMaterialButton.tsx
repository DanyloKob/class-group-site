"use client";

import { useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { AddMaterialSheet } from "@/app/(app)/projects/_components/AddMaterialSheet";

export function AddMaterialButton({ topicId }: { topicId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="Новий матеріал"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-background transition-transform active:scale-90"
      >
        <Plus size={18} weight="bold" />
      </button>
      <AddMaterialSheet open={open} onOpenChange={setOpen} topicId={topicId} />
    </>
  );
}
