import { parseDateParam, todayInKyiv } from "@/lib/schedule/parity";

const DAY_MS = 24 * 60 * 60 * 1000;

const longFormatter = new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long", timeZone: "UTC" });
const SHORT_MONTHS = ["січ", "лют", "бер", "кві", "тра", "чер", "лип", "сер", "вер", "жов", "лис", "гру"];

/** Whole days from today (Kyiv) to a "YYYY-MM-DD" due date. Negative = past. */
export function daysUntil(dueDate: string, today: string = todayInKyiv()): number {
  return Math.round((parseDateParam(dueDate).getTime() - parseDateParam(today).getTime()) / DAY_MS);
}

export function dueLabel(dueDate: string, today?: string): { text: string; urgent: boolean } {
  const diff = daysUntil(dueDate, today);
  if (diff === 0) return { text: "сьогодні", urgent: true };
  if (diff === 1) return { text: "завтра", urgent: true };
  if (diff >= 2 && diff <= 6) return { text: `через ${diff} дн.`, urgent: false };
  return { text: `до ${longFormatter.format(parseDateParam(dueDate))}`, urgent: false };
}

/** "24 лис" in Kyiv time, from an ISO instant. */
export function formatShortDate(iso: string): string {
  const kyiv = new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/Kyiv" });
  const [, m, d] = kyiv.split("-").map(Number);
  return `${d} ${SHORT_MONTHS[m - 1]}`;
}

/** «2,9 МБ», «24 МБ»; small files in КБ so a 17 KB PDF never reads «0,0 МБ». */
export function formatSizeMb(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb < 0.1) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1).replace(".", ",")} МБ`;
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
