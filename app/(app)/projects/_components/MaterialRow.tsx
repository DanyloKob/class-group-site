"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FilePdf, LinkSimple, PresentationChart } from "@phosphor-icons/react";
import { DeleteConfirmButton } from "@/components/shared/DeleteConfirmButton";
import { formatShortDate, formatSizeMb, hostnameOf } from "@/app/(app)/projects/_lib/format";
import type { MaterialRow as MaterialRowData } from "@/lib/server/projects";

export function MaterialRow({ material }: { material: MaterialRowData }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [removing, setRemoving] = useState(false);

  const Icon = material.kind === "LINK" ? LinkSimple : material.kind === "PDF" ? FilePdf : PresentationChart;

  async function remove() {
    setFailed(false);
    setRemoving(true);
    try {
      const res = await fetch(`/api/projects/materials/${material.id}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
        return;
      }
      setFailed(true);
    } catch {
      setFailed(true);
    }
    setRemoving(false);
  }

  const secondary =
    material.kind === "LINK"
      ? material.url
        ? hostnameOf(material.url)
        : null
      : [material.fileName, material.fileSize != null ? formatSizeMb(material.fileSize) : null]
          .filter(Boolean)
          .join(" · ");

  return (
    <div className={`flex flex-col gap-2.5 rounded-2xl bg-surface p-3.5 transition-opacity ${removing ? "opacity-50" : ""}`}>
      <div className="flex gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-elevated text-accent">
          <Icon size={18} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {material.text && <p className="line-clamp-2 break-words text-sm leading-snug">{material.text}</p>}
          {secondary && <p className="truncate text-xs text-ink-muted">{secondary}</p>}
          <p className="text-xs text-ink-muted">
            {formatShortDate(material.createdAt)} · {material.authorName}
          </p>
          {material.kind === "PPTX" && material.conversionStatus === "PENDING" && (
            <span className="w-fit rounded-full bg-surface-elevated px-2 py-0.5 text-[11px] text-ink-muted">
              Готуємо слайди
            </span>
          )}
          {material.kind === "PPTX" && material.conversionStatus === "FAILED" && (
            <span className="w-fit rounded-full bg-surface-elevated px-2 py-0.5 text-[11px] text-ink-muted">
              Без перегляду
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <a
          href={`/m/${material.token}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-10 items-center rounded-full bg-accent/12 px-4 text-sm font-medium text-accent transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]"
        >
          Відкрити
        </a>
        {material.canDelete && <DeleteConfirmButton onConfirm={remove} />}
      </div>
      {failed && (
        <p role="alert" className="text-xs text-danger">
          Не вдалося видалити матеріал.
        </p>
      )}
    </div>
  );
}
