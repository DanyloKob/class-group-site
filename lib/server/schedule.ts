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

export async function getDaySchedule(dateStr: string, currentUserId: string) {
  const date = parseDateParam(dateStr);
  const weekday = getWeekdayName(date);

  const settings = await getScheduleSettings();
  const { anchorDate, anchorType } = await resolveAnchor(settings);
  const parity = getWeekParity(date, anchorDate, anchorType);

  const [classTemplates, classOverrides, dutyRows, homeworkRows] = await Promise.all([
    weekday ? prisma.classTemplate.findMany({ where: { weekday, parity } }) : Promise.resolve([]),
    prisma.classOverride.findMany({ where: { date } }),
    prisma.dutyAssignment.findMany({
      where: { date },
      include: { person: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: [{ person: { lastName: "asc" } }, { person: { firstName: "asc" } }],
    }),
    prisma.homework.findMany({
      where: { date },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { likes: true } },
        likes: { where: { userId: currentUserId }, select: { userId: true } },
      },
    }),
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

  function homeworkFor(slot: number, scope: "A" | "B" | "SHARED") {
    return homeworkRows
      .filter((h) => h.slot === slot && h.scope === scope)
      .map((h) => ({
        id: h.id,
        text: h.text,
        author: h.author,
        createdAt: h.createdAt,
        likeCount: h._count.likes,
        likedByMe: h.likes.length > 0,
        isMine: h.authorId === currentUserId,
      }))
      .sort((x, y) => y.likeCount - x.likeCount || x.createdAt.getTime() - y.createdAt.getTime());
  }

  const slots = resolvedSlots.map((slot) => {
    // Homework's scope must match what's actually on screen: one shared
    // thread for a merged slot, two independent threads when split.
    const scopeA = slot.merged ? ("SHARED" as const) : ("A" as const);
    const scopeB = slot.merged ? ("SHARED" as const) : ("B" as const);
    return {
      slot: slot.slot,
      merged: slot.merged,
      a: slot.a,
      b: slot.b,
      homeworkScopeA: scopeA,
      homeworkScopeB: scopeB,
      homeworkA: homeworkFor(slot.slot, scopeA),
      homeworkB: homeworkFor(slot.slot, scopeB),
    };
  });

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
