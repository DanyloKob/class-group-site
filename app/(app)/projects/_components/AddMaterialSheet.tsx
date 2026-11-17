"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BottomSheet } from "@/components/shared/BottomSheet";
import { formatSizeMb } from "@/app/(app)/projects/_lib/format";

const FIELD = "rounded-xl bg-surface px-3 py-2.5 text-sm outline-none ring-accent focus:ring-2";
const MAX_BYTES = 80 * 1024 * 1024;
const TEXT_MAX = 2000;

type Mode = "LINK" | "FILE";

const ERROR_COPY: Record<string, string> = {
  too_large: "Файл більший за 80 МБ.",
  bad_name: "Підтримуються лише PDF і PPTX.",
  unsupported_type: "Підтримуються лише PDF і PPTX.",
  bad_file: "Файл пошкоджений, захищений паролем або не того формату.",
  bad_url: "Посилання має починатися з http:// або https://.",
  storage_not_configured: "Завантаження файлів ще не налаштоване.",
};
const GENERIC_ERROR = "Не вдалося додати матеріал.";

type UploadResult = { ok: true; uploadId: string } | { ok: false; code: string };

function uploadFile(file: File, onProgress: (percent: number) => void): Promise<UploadResult> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/projects/uploads");
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      let body: { uploadId?: string; error?: string } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // non-JSON error body: fall through to the generic copy
      }
      if (xhr.status >= 200 && xhr.status < 300 && body.uploadId) {
        resolve({ ok: true, uploadId: body.uploadId });
      } else {
        resolve({ ok: false, code: body.error ?? (xhr.status === 413 ? "too_large" : "") });
      }
    };
    xhr.onerror = () => resolve({ ok: false, code: "" });
    xhr.send(file);
  });
}

export function AddMaterialSheet({
  open,
  onOpenChange,
  topicId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topicId: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("LINK");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const canSubmit = !busy && (mode === "LINK" ? url.trim().length > 0 : file !== null);

  function reset() {
    setMode("LINK");
    setUrl("");
    setFile(null);
    setText("");
    setProgress(null);
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    // Closing mid-upload would orphan the request, so keep the sheet up.
    if (!next && busy) return;
    onOpenChange(next);
  }

  function pickFile(picked: File | null) {
    setError(null);
    if (picked && picked.size > MAX_BYTES) {
      setFile(null);
      setError(ERROR_COPY.too_large);
      return;
    }
    setFile(picked);
  }

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const trimmedText = text.trim();
      let payload: Record<string, unknown>;
      if (mode === "LINK") {
        payload = { kind: "LINK", url: url.trim() };
      } else {
        setProgress(0);
        const upload = await uploadFile(file!, setProgress);
        if (!upload.ok) {
          setError(ERROR_COPY[upload.code] ?? GENERIC_ERROR);
          return;
        }
        payload = { kind: "FILE", uploadId: upload.uploadId };
      }
      if (trimmedText) payload.text = trimmedText;

      const res = await fetch(`/api/projects/topics/${topicId}/materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let code = "";
        try {
          code = (await res.json()).error ?? "";
        } catch {
          // keep the generic copy
        }
        setError(ERROR_COPY[code] ?? GENERIC_ERROR);
        return;
      }
      onOpenChange(false);
      reset();
      router.refresh();
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={handleOpenChange} title="Новий матеріал">
      <div className="flex flex-col gap-4">
        <div className="relative flex rounded-full bg-surface p-1">
          {(["LINK", "FILE"] as const).map((option) => (
            <button
              key={option}
              type="button"
              disabled={busy}
              onClick={() => {
                setMode(option);
                setError(null);
              }}
              className="relative z-10 flex-1 rounded-full py-2 text-sm font-medium"
            >
              {mode === option && (
                <motion.div
                  layoutId="material-mode-active"
                  className="absolute inset-0 -z-10 rounded-full bg-ink"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <span className={mode === option ? "text-background" : "text-ink-muted"}>
                {option === "LINK" ? "Посилання" : "Файл"}
              </span>
            </button>
          ))}
        </div>

        {mode === "LINK" ? (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-ink-muted" htmlFor="material-url">
              Посилання (http або https)
            </label>
            <input
              id="material-url"
              type="url"
              inputMode="url"
              autoComplete="off"
              value={url}
              maxLength={2000}
              onChange={(e) => setUrl(e.target.value)}
              className={FIELD}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <input
              ref={inputRef}
              type="file"
              hidden
              accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="rounded-xl border border-dashed border-border bg-surface px-3 py-4 text-left transition-transform active:scale-[0.99]"
            >
              {file ? (
                <>
                  <span className="block truncate text-sm">{file.name}</span>
                  <span className="text-xs text-ink-muted">{formatSizeMb(file.size)}</span>
                </>
              ) : (
                <span className="text-sm text-ink-muted">Обрати файл</span>
              )}
            </button>
            <p className="text-xs text-ink-muted">PDF або PowerPoint (.pptx), до 80 МБ</p>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-ink-muted" htmlFor="material-text">
            Текст (необов&apos;язково)
          </label>
          <textarea
            id="material-text"
            value={text}
            rows={3}
            maxLength={TEXT_MAX}
            onChange={(e) => setText(e.target.value)}
            className={`resize-none ${FIELD}`}
          />
          {text.length > 1800 && (
            <p className="text-right text-[11px] text-ink-muted">
              {text.length} / {TEXT_MAX}
            </p>
          )}
        </div>

        {progress !== null && (
          <div className="flex flex-col gap-1.5" role="status">
            <div className="h-1 overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-200 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-ink-muted">Завантаження… {progress}%</p>
          </div>
        )}

        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="mt-2 rounded-full bg-ink py-3 text-sm font-medium text-background transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          Додати
        </button>
      </div>
    </BottomSheet>
  );
}
