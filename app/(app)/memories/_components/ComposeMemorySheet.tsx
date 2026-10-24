"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Camera, X } from "@phosphor-icons/react";
import { BottomSheet } from "@/components/shared/BottomSheet";

const MAX_IMAGES = 10;

export function ComposeMemorySheet({
  open,
  onOpenChange,
  onPosted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPosted: () => void;
}) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // previews are fully derived from files - no separate state needed. The
  // effect below only revokes the URLs on cleanup, it never calls setState.
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => {
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, [previews]);

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setBody("");
      setFiles([]);
      setError(null);
    }
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files, ...Array.from(list)].slice(0, MAX_IMAGES);
    setFiles(next);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit() {
    if (!body.trim() && files.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      if (body.trim()) formData.set("body", body.trim());
      files.forEach((file) => formData.append("images", file));

      const res = await fetch("/api/memories", { method: "POST", body: formData });
      if (res.ok) {
        onOpenChange(false);
        onPosted();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error === "invalid_image" ? "Один із файлів не є PNG/JPG зображенням." : "Не вдалося опублікувати.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="Новий спогад">
      <div className="flex flex-col gap-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Підпис до фото..."
          className="resize-none rounded-xl bg-surface px-3 py-2.5 text-sm outline-none ring-accent focus:ring-2"
        />

        <div className="flex flex-wrap gap-2">
          {previews.map((url, i) => (
            <motion.div
              key={url}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative h-16 w-16 overflow-hidden rounded-lg"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview, not a servable asset */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="absolute right-0 top-0 rounded-full bg-black/60 p-1.5 text-white transition-transform active:scale-90"
              >
                <X size={11} />
              </button>
            </motion.div>
          ))}
          {files.length < MAX_IMAGES && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-lg bg-surface text-ink-muted"
            >
              <Camera size={18} />
              <span className="text-[10px]">
                {files.length}/{MAX_IMAGES}
              </span>
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />

        {error && <p className="text-xs text-danger">{error}</p>}

        <button
          type="button"
          onClick={submit}
          disabled={submitting || (!body.trim() && files.length === 0)}
          className="rounded-full bg-ink py-3 text-sm font-medium text-background transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          Опублікувати
        </button>
      </div>
    </BottomSheet>
  );
}
