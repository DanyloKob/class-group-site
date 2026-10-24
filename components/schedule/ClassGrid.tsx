"use client";

import { useState } from "react";
import { ClassCard } from "@/components/schedule/ClassCard";
import { HomeworkPanel } from "@/components/schedule/HomeworkPanel";
import type { ResolvedDaySlot } from "@/lib/server/schedule";
import type { ClassGroupScope } from "@/lib/generated/prisma/enums";

type OpenPanel = { slot: number; scope: ClassGroupScope; subject: string } | null;

export function ClassGrid({
  slots,
  dateParam,
  canManage,
  onHomeworkChanged,
}: {
  slots: ResolvedDaySlot[];
  dateParam: string;
  canManage: boolean;
  onHomeworkChanged: () => void;
}) {
  // `openPanel` tracks which slot/scope the sheet targets and is never
  // cleared on close (only replaced when a different slot is tapped) - the
  // sheet itself stays mounted and just toggles `panelOpen`, so its close
  // animation has real content to animate away instead of unmounting blank.
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  // Derived from the live `slots` prop (not its own fetch), so once the
  // parent refetches after a mutation, the already-open panel's entry list
  // and like counts update along with everything else on screen.
  const openPanelRow = openPanel ? slots.find((row) => row.slot === openPanel.slot) : undefined;
  const openPanelEntries = openPanelRow
    ? openPanel!.scope === openPanelRow.homeworkScopeA
      ? openPanelRow.homeworkA
      : openPanelRow.homeworkB
    : [];

  function openHomework(slot: number, scope: ClassGroupScope, subject: string) {
    setOpenPanel({ slot, scope, subject });
    setPanelOpen(true);
  }

  if (slots.length === 0) {
    return <p className="px-5 text-center text-xs text-ink-muted">Пар не заплановано.</p>;
  }

  return (
    <div className="flex flex-col gap-2 px-5">
      {slots.map((row) => (
        <div key={row.slot} className={`grid gap-2 ${row.merged ? "grid-cols-1" : "grid-cols-2"}`}>
          {row.merged ? (
            <ClassCard
              content={row.a}
              homeworkCount={row.homeworkA.length}
              onOpenHomework={() => openHomework(row.slot, row.homeworkScopeA, row.a?.subject ?? "")}
            />
          ) : (
            <>
              <ClassCard
                content={row.a}
                homeworkCount={row.homeworkA.length}
                onOpenHomework={() => openHomework(row.slot, row.homeworkScopeA, row.a?.subject ?? "")}
              />
              <ClassCard
                content={row.b}
                homeworkCount={row.homeworkB.length}
                onOpenHomework={() => openHomework(row.slot, row.homeworkScopeB, row.b?.subject ?? "")}
              />
            </>
          )}
        </div>
      ))}

      {openPanel && (
        <HomeworkPanel
          open={panelOpen}
          onOpenChange={setPanelOpen}
          date={dateParam}
          slot={openPanel.slot}
          scope={openPanel.scope}
          subjectLabel={openPanel.subject}
          entries={openPanelEntries}
          canManage={canManage}
          onChanged={onHomeworkChanged}
        />
      )}
    </div>
  );
}
