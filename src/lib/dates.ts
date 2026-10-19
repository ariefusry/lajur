const TZ = "Asia/Jakarta";
const DAY_MS = 86_400_000;

/** "YYYY-MM-DD" of the given instant in Jakarta time (value for <input type="date">). */
export function toDateInput(date: Date | null | undefined): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(date);
}

/** "YYYY-MM-DD" from a date input → midnight Jakarta time. */
export function fromDateInput(value: string): Date {
  return new Date(`${value}T00:00:00+07:00`);
}

/** Calendar days from today to `date`, both in Jakarta time. Negative = already past. */
export function daysUntil(date: Date, now = new Date()): number {
  return Math.round((Date.parse(toDateInput(date)) - Date.parse(toDateInput(now))) / DAY_MS);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" }).format(
    date,
  );
}

/** "YYYY-MM-DDTHH:mm" in Jakarta time (value for <input type="datetime-local">). */
export function toDateTimeInput(date: Date | null | undefined): string {
  if (!date) return "";
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return `${toDateInput(date)}T${time}`;
}

/** "YYYY-MM-DDTHH:mm" entered as Jakarta wall-clock time → instant. */
export function fromDateTimeInput(value: string): Date {
  return new Date(`${value}:00+07:00`);
}

export function formatDateTime(date: Date): string {
  return (
    new Intl.DateTimeFormat("id-ID", {
      timeZone: TZ,
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date) + " WIB"
  );
}

/** "Kam, 23 Okt, 09.00": short enough for a board card. */
export function formatShortDateTime(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
