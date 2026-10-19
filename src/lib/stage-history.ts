import type { StageKind } from "../generated/prisma/enums.ts";

/** One history step, oldest first. `kept`: it holds notes or a result, so it is never dropped. */
export type HistoryStep = { id: string; stageId: string; order: number; kept: boolean };

/**
 * What moving an application to `target` does to its history. Moving back means the steps ahead of the target
 * (a later stage) were a mis-drop or didn't really happen, so they are dropped, newest first, until a step that
 * comes before the target or one that holds notes/a result. The target is then appended unless the history
 * already ends there (it was visited before).
 *
 * So Wishlist → MCU (mis-drop) → Administrasi records Wishlist → Administrasi, and a card dragged around wildly
 * ends with a history that reads in stage order.
 */
export function planStageChange(history: HistoryStep[], target: { id: string; order: number }) {
  let end = history.length;
  while (end > 0) {
    const last = history[end - 1];
    if (last.stageId === target.id || last.order < target.order || last.kept) break;
    end--;
  }
  return { drop: history.slice(end).map((s) => s.id), append: history[end - 1]?.stageId !== target.id };
}

/**
 * Dates for the steps that "Tanggal melamar" decides: the first step after Wishlist is when the user applied, and a
 * Wishlist step before it comes just ahead of it (so the order still reads Wishlist, then applying). Later steps
 * keep their own times. Nothing changes when there is no date, or when it falls after the step that follows, since
 * that would put the history out of order.
 */
export function planAppliedAtDates(
  history: { id: string; kind: StageKind; enteredAt: Date }[], // oldest first
  appliedAt: Date | null,
): { id: string; enteredAt: Date }[] {
  if (!appliedAt) return [];
  const first = history.findIndex((h) => h.kind !== "WISHLIST");
  if (first < 0) return [];
  const next = history[first + 1];
  if (next && appliedAt.getTime() > next.enteredAt.getTime()) return [];
  return [
    ...history.slice(0, first).map((h) => ({ id: h.id, enteredAt: new Date(appliedAt.getTime() - 1) })),
    { id: history[first].id, enteredAt: appliedAt },
  ];
}
