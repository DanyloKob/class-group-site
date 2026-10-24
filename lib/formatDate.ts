const dateFormatter = new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long" });
const dateTimeFormatter = new Intl.DateTimeFormat("uk-UA", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatEventDate(date: Date | string): string {
  const d = new Date(date);
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  return hasTime ? dateTimeFormatter.format(d) : dateFormatter.format(d);
}
