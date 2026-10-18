import { toDateInput } from "./dates";

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

const stamp = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, ""); // 20261019T020000Z
const day = (d: Date) => toDateInput(d).replaceAll("-", ""); // Jakarta calendar day

/**
 * "Add to Google Calendar" link (prefilled event form, nothing is sent until the user saves it there).
 * Timed events last one hour; all-day events (deadlines) cover the Jakarta date of `start`.
 */
export function googleCalendarUrl(e: {
  title: string;
  start: Date;
  allDay?: boolean;
  details?: string;
  location?: string | null;
}) {
  const dates = e.allDay
    ? `${day(e.start)}/${day(new Date(e.start.getTime() + DAY_MS))}`
    : `${stamp(e.start)}/${stamp(new Date(e.start.getTime() + HOUR_MS))}`;
  const q = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates, ctz: "Asia/Jakarta" });
  if (e.details) q.set("details", e.details);
  if (e.location) q.set("location", e.location);
  return `https://calendar.google.com/calendar/render?${q}`;
}
