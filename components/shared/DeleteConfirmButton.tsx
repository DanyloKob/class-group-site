"use client";

import { useEffect, useRef, useState } from "react";
import { Trash } from "@phosphor-icons/react";

/**
 * Two-stage tap instead of window.confirm() or a modal: first tap arms a
 * "Точно?" state for a few seconds, second tap while armed commits. Arms
 * reset automatically so a stray later tap elsewhere can't land as a delete.
 */
export function DeleteConfirmButton({ onConfirm, label = "Видалити" }: { onConfirm: () => void; label?: string }) {
  const [armed, setArmed] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  function handleClick() {
    if (armed) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      // Reset immediately, not after onConfirm() - if the caller's removal
      // is async (a fetch, a parent re-render waiting on a response), a
      // stray tap while still "armed" must not fire a second delete.
      setArmed(false);
      onConfirm();
      return;
    }
    setArmed(true);
    timeoutRef.current = setTimeout(() => setArmed(false), 3000);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex min-h-10 items-center gap-1 rounded-full px-3 py-2 text-xs transition-colors active:scale-95 ${
        armed ? "bg-danger text-danger-ink" : "text-ink-muted"
      }`}
    >
      <Trash size={14} />
      {armed ? "Точно?" : label}
    </button>
  );
}
