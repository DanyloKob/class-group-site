// Pure date math, no server-only dependencies - safe to import from client
// components (the day swiper needs this in the browser).

export function toDateParam(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromDateParam(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

export type DateBounds = { min: Date; max: Date };

/** Weekdays only, in a window around `center`, for the day-swiper strip.
 * `bounds`, when given, excludes anything outside the school year - the
 * strip should never offer a day with no schedule to navigate to. */
export function weekdayRange(center: Date, daysBefore: number, daysAfter: number, bounds?: DateBounds): Date[] {
  const days: Date[] = [];
  const cursor = new Date(center);
  cursor.setDate(cursor.getDate() - daysBefore);
  const end = new Date(center);
  end.setDate(end.getDate() + daysAfter);

  while (cursor <= end) {
    const inBounds = !bounds || (cursor >= bounds.min && cursor <= bounds.max);
    if (isWeekday(cursor) && inBounds) days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

/** One weekday step (skips Sat/Sun), in either direction. Returns null
 * instead of stepping past `bounds` - the caller simply doesn't navigate
 * rather than landing outside the school year. */
export function stepWeekday(date: Date, direction: 1 | -1, bounds?: DateBounds): Date | null {
  const next = new Date(date);
  do {
    next.setDate(next.getDate() + direction);
    if (bounds && (next < bounds.min || next > bounds.max)) return null;
  } while (!isWeekday(next));
  return next;
}

const WEEKDAY_SHORT = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const MONTH_SHORT = [
  "січ",
  "лют",
  "бер",
  "кві",
  "тра",
  "чер",
  "лип",
  "сер",
  "вер",
  "жов",
  "лис",
  "гру",
];

const MONTH_FULL = [
  "Січень",
  "Лютий",
  "Березень",
  "Квітень",
  "Травень",
  "Червень",
  "Липень",
  "Серпень",
  "Вересень",
  "Жовтень",
  "Листопад",
  "Грудень",
];

// Ukrainian dates take the genitive ("1 вересня", not "1 вересень"), which
// is a different form from the standalone month name above.
const MONTH_GENITIVE = [
  "січня",
  "лютого",
  "березня",
  "квітня",
  "травня",
  "червня",
  "липня",
  "серпня",
  "вересня",
  "жовтня",
  "листопада",
  "грудня",
];

/** "Пн, 1 вересня" from a "YYYY-MM-DD" date key. */
export function dayLongLabel(dateStr: string): string {
  const date = fromDateParam(dateStr);
  return `${weekdayShortLabel(date)}, ${date.getDate()} ${MONTH_GENITIVE[date.getMonth()]}`;
}

/** "Вересень 2026" from a "YYYY-MM" month key. */
export function monthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return `${MONTH_FULL[m - 1]} ${year}`;
}

/** Every Mon-Fri date in a "YYYY-MM" month, in order. */
export function monthWeekdays(month: string): Date[] {
  const [year, m] = month.split("-").map(Number);
  const days: Date[] = [];
  const cursor = new Date(year, m - 1, 1);
  while (cursor.getMonth() === m - 1) {
    if (isWeekday(cursor)) days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

/** Steps a "YYYY-MM" key by whole months without ever touching day-of-month
 * arithmetic, which is where month-boundary bugs come from. */
export function stepMonth(month: string, direction: 1 | -1): string {
  const [year, m] = month.split("-").map(Number);
  const zeroBased = (year * 12 + (m - 1)) + direction;
  const nextYear = Math.floor(zeroBased / 12);
  const nextMonth = zeroBased - nextYear * 12 + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

export function weekdayShortLabel(date: Date): string {
  return WEEKDAY_SHORT[date.getDay()];
}

export function dayMonthLabel(date: Date): string {
  return `${date.getDate()} ${MONTH_SHORT[date.getMonth()]}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
