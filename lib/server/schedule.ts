import "server-only";
import { prisma } from "@/lib/db";
import { getWeekParity, getWeekdayName, parseDateParam } from "@/lib/schedule/parity";
import { resolveDayClasses } from "@/lib/schedule/resolve";
import type { ClassOverrideRow, ClassTemplateRow } from "@/lib/schedule/resolve";
import type { DutyType, WeekParity } from "@/lib/generated/prisma/enums";

const DEFAULT_ANCHOR_TYPE: WeekParity = "NUMERATOR";

export async function getScheduleSettings() {
  return prisma.scheduleSettings.findUnique({ where: { id: "singleton" } });
}

async function resolveAnchor(settings: Awaited<ReturnType<typeof getScheduleSettings>>) {
  if (settings) return { anchorDate: settings.parityAnchorDate, anchorType: settings.parityAnchorType };
  // Nothing configured yet (day one) - fall back to "today is NUMERATOR" so
  // the read side never crashes; the admin settings screen prompts setup.
  return { anchorDate: new Date(), anchorType: DEFAULT_ANCHOR_TYPE };
}

export async function getDaySchedule(dateStr: string, opts: { includeDuty: boolean }) {
  const date = parseDateParam(dateStr);
  const weekday = getWeekdayName(date);

  const settings = await getScheduleSettings();
  const { anchorDate, anchorType } = await resolveAnchor(settings);
  const parity = getWeekParity(date, anchorDate, anchorType);

  const [classTemplates, classOverrides, dutyRows] = await Promise.all([
    weekday ? prisma.classTemplate.findMany({ where: { weekday, parity } }) : Promise.resolve([]),
    prisma.classOverride.findMany({ where: { date } }),
    opts.includeDuty
      ? prisma.dutyAssignment.findMany({
          where: { date },
          include: { person: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: [{ person: { lastName: "asc" } }, { person: { firstName: "asc" } }],
        })
      : Promise.resolve([]),
  ]);

  const dutyPeople = (dutyType: DutyType) =>
    dutyRows
      .filter((d) => d.dutyType === dutyType)
      .map((d) => ({ personId: d.person.id, personName: `${d.person.lastName} ${d.person.firstName}` }));

  const cafeteria = dutyPeople("CAFETERIA");
  const board = dutyPeople("BOARD");

  const classTemplateRows: ClassTemplateRow[] = classTemplates;
  const classOverrideRows: ClassOverrideRow[] = classOverrides;
  const resolvedSlots = resolveDayClasses(classTemplateRows, classOverrideRows);

  const slots = resolvedSlots.map((slot) => ({
    slot: slot.slot,
    merged: slot.merged,
    a: slot.a,
    b: slot.b,
  }));

  return {
    date: dateStr,
    weekday,
    parity,
    hasSettings: settings !== null,
    cafeteria,
    board,
    slots,
  };
}

export type DaySchedule = Awaited<ReturnType<typeof getDaySchedule>>;
export type ResolvedDaySlot = DaySchedule["slots"][number];
