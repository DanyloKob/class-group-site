"use client";

import { useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { CreateTopicSheet } from "@/app/(app)/projects/_components/CreateTopicSheet";

export function CreateTopicButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="Нова тема"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-background transition-transform active:scale-90"
      >
        <Plus size={18} weight="bold" />
      </button>
      <CreateTopicSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
