/**
 * Normalizes a phone number to E.164 ("+380971234567") so that admin-entered
 * numbers and Telegram's contact.phone_number (which arrives without a "+")
 * always compare equal. Optimized for Ukrainian numbers since that's this
 * group's whole userbase, but falls back gracefully for anything else.
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");

  if (digits.length === 10 && digits.startsWith("0")) {
    return `+38${digits}`;
  }
  if (digits.length === 12 && digits.startsWith("380")) {
    return `+${digits}`;
  }
  if (digits.length === 9) {
    return `+380${digits}`;
  }
  return `+${digits}`;
}
