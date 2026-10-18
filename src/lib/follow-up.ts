import { daysUntil, fromDateInput, toDateInput } from "./dates";

const DAY_MS = 86_400_000;

/** "Ingatkan lagi dalam …" choices after a follow-up, in days. */
export const FOLLOW_UP_INTERVALS = [3, 7, 14] as const;

/** Jakarta midnight `days` calendar days after today (Jakarta has no DST, so day arithmetic is exact). */
export function followUpDate(now: Date, days: number) {
  return new Date(fromDateInput(toDateInput(now)).getTime() + days * DAY_MS);
}

/** Due today or overdue (Jakarta calendar days). */
export const isFollowUpDue = (nextActionAt: Date | null, now: Date) => !!nextActionAt && daysUntil(nextActionAt, now) <= 0;
