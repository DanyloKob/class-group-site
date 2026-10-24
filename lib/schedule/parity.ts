import type { WeekParity, Weekday } from "@/lib/generated/prisma/enums";

const KYIV_TIME_ZONE = "Europe/Kyiv";

/** "What is today" must resolve in Kyiv time, not server-local/UTC. */
export function todayInKyiv(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: KYIV_TIME_ZONE }).format(new Date());
}

/**
 * The Sept 1 - May 31 school year containing `dateStr` (a "YYYY-MM-DD").
 * June-August counts as part of the *upcoming* year, not the one that just
 * ended in May - during summer the group is anticipating the next cycle,
 * not still looking back at the last one, matching how a "start from
 * September" school-year picker should behave the moment August ends.
 */
export function academicYearRange(dateStr: string): { start: string; end: string } {
  const month = Number(dateStr.slice(5, 7));
  const year = Number(dateStr.slice(0, 4));
  const startYear = month >= 9 ? year : month <= 5 ? year - 1 : year; // 6-8 (summer) -> this year's September
  return { start: `${startYear}-09-01`, end: `${startYear + 1}-05-31` };
}

/** Pulls `dateStr` inside its own academic year's Sept-May bounds if it falls outside them. */
export function clampToAcademicYear(dateStr: string): string {
  const { start, end } = academicYearRange(dateStr);
  if (dateStr < start) return start;
  if (dateStr > end) return end;
  return dateStr;
}

/**
 * What the schedule tab should default to - literal "today" on a weekday,
 * but the coming Monday on a Saturday/Sunday. There's no class schedule to
 * show on a weekend (the day-strip only ever renders Mon-Fri, see
 * dateRange.ts's isWeekday filter), so landing on the literal weekend date
 * would select a day that can never appear as "active" in that strip -
 * exactly the "nothing selected" bug this sidesteps. Also clamped to the
 * Sept-May school year, so opening the app in summer lands on the coming
 * September rather than a date with no schedule data at all.
 */
export function defaultScheduleDate(): string {
  const [y, m, d] = todayInKyiv().split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = date.getUTCDay(); // 0=Sun..6=Sat
  if (dayOfWeek === 0) date.setUTCDate(date.getUTCDate() + 1); // Sun -> Mon
  else if (dayOfWeek === 6) date.setUTCDate(date.getUTCDate() + 2); // Sat -> Mon
  const pad = (n: number) => String(n).padStart(2, "0");
  const withWeekendShift = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  return clampToAcademicYear(withWeekendShift);
}

function isoWeekday(d: Date): number {
  const wd = d.getUTCDay(); // 0=Sun..6=Sat
  return wd === 0 ? 7 : wd; // 1=Mon..7=Sun
}

/** Monday 00:00 UTC of the ISO week containing `d`. Pure UTC-midnight math -
 * a DST-safety technique, unrelated to which timezone the user is in. */
function startOfIsoWeekUTC(d: Date): Date {
  const copy = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  copy.setUTCDate(copy.getUTCDate() - (isoWeekday(copy) - 1));
  return copy;
}

function weeksBetween(a: Date, b: Date): number {
  const MS_PER_DAY = 86_400_000;
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY) / 7;
}

/**
 * Computes which parity ("чисельник"/"знаменник") applies to `date`, given a
 * single admin-set anchor: "the week containing anchorDate has anchorType".
 * Parity is derived live from this anchor for every date, never stored per
 * date - editing the anchor retroactively reclassifies every date, past and
 * future, which is correct for fixing a mistake but should be a deliberate
 * admin action (the settings UI warns about this explicitly).
 */
export function getWeekParity(date: Date, anchorDate: Date, anchorType: WeekParity): WeekParity {
  const anchorWeekStart = startOfIsoWeekUTC(anchorDate);
  const targetWeekStart = startOfIsoWeekUTC(date);
  const deltaWeeks = weeksBetween(anchorWeekStart, targetWeekStart);
  const flips = ((Math.round(deltaWeeks) % 2) + 2) % 2;
  if (flips === 0) return anchorType;
  return anchorType === "NUMERATOR" ? "DENOMINATOR" : "NUMERATOR";
}

// Only 5 values - matches Prisma's Weekday enum exactly, so callers never
// need to narrow "SATURDAY"/"SUNDAY" back out of the type.
const WEEKDAY_ORDER: Weekday[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];

/** Returns null for Sat/Sun - duty/class templates are Mon-Fri only by design. */
export function getWeekdayName(date: Date): Weekday | null {
  const iso = isoWeekday(date); // 1=Mon..7=Sun
  return iso > 5 ? null : WEEKDAY_ORDER[iso - 1];
}

/** Parses a "YYYY-MM-DD" (as used throughout the schedule API) into a UTC-midnight Date. */
export function parseDateParam(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatDateParam(date: Date): string {
  return date.toISOString().slice(0, 10);
}
