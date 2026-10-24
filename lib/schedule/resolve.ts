import type { ClassGroupScope } from "@/lib/generated/prisma/enums";

// ── Class schedule: template + override merge ────────────────────────────

export type ClassTemplateRow = {
  id: string;
  slot: number;
  scope: ClassGroupScope;
  subject: string;
  teacher: string;
  room: string;
};

export type ClassOverrideRow = {
  id: string;
  slot: number;
  scope: ClassGroupScope;
  isCancelled: boolean;
  subject: string | null;
  teacher: string | null;
  room: string | null;
  note: string | null;
};

export type SlotContent = {
  subject: string;
  teacher: string;
  room: string;
  isCancelled: boolean;
  note: string | null;
  sourceId: string;
} | null;

export type ResolvedSlot = { slot: number; merged: boolean; a: SlotContent; b: SlotContent };

function mergeOverrideOntoTemplate(
  override: ClassOverrideRow | undefined,
  template: ClassTemplateRow | undefined,
): SlotContent {
  if (!override && !template) return null;
  if (override) {
    return {
      subject: override.subject ?? template?.subject ?? (override.isCancelled ? "Скасовано" : ""),
      teacher: override.teacher ?? template?.teacher ?? "",
      room: override.room ?? template?.room ?? "",
      isCancelled: override.isCancelled,
      note: override.note,
      sourceId: override.id,
    };
  }
  return {
    subject: template!.subject,
    teacher: template!.teacher,
    room: template!.room,
    isCancelled: false,
    note: null,
    sourceId: template!.id,
  };
}

/**
 * Read priority per group: override(group) -> override(SHARED) ->
 * template(group) -> template(SHARED) -> empty. "merged" (spans both
 * columns) is derived from whether A and B resolved to the literal same
 * row, not a stored flag - so splitting a normally-shared slot for one date
 * only just works, no special-casing needed.
 */
export function resolveSlot(
  slotNum: number,
  templates: ClassTemplateRow[],
  overrides: ClassOverrideRow[],
): ResolvedSlot {
  const findOv = (scope: ClassGroupScope) => overrides.find((o) => o.slot === slotNum && o.scope === scope);
  const findTpl = (scope: ClassGroupScope) => templates.find((t) => t.slot === slotNum && t.scope === scope);

  function contentFor(group: "A" | "B"): SlotContent {
    const override = findOv(group) ?? findOv("SHARED");
    const template = findTpl(group) ?? findTpl("SHARED");
    return mergeOverrideOntoTemplate(override, template);
  }

  const a = contentFor("A");
  const b = contentFor("B");
  const merged = a !== null && b !== null && a.sourceId === b.sourceId;

  return { slot: slotNum, merged, a, b };
}

const MAX_SLOTS = 4;

/** Omits a slot entirely when neither group has anything there - a 3-class
 * day shows 3 rows, not 4 with a dangling blank. A cancelled class still
 * renders (as isCancelled) rather than vanishing. */
export function resolveDayClasses(templates: ClassTemplateRow[], overrides: ClassOverrideRow[]): ResolvedSlot[] {
  const slotNumbers = new Set<number>();
  templates.forEach((t) => slotNumbers.add(t.slot));
  overrides.forEach((o) => slotNumbers.add(o.slot));

  return Array.from(slotNumbers)
    .filter((n) => n >= 1 && n <= MAX_SLOTS)
    .sort((a, b) => a - b)
    .map((slotNum) => resolveSlot(slotNum, templates, overrides))
    .filter((resolved) => resolved.a !== null || resolved.b !== null);
}
