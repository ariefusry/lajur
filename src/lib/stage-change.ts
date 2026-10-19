import "server-only";

import { planStageChange } from "@/lib/stage-history";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Moves an application to another stage and fixes up its history (see planStageChange). Shared by the board
 * and the edit form. The row lock makes two moves at once (two tabs, two devices) run one after the other
 * instead of both reading the same history.
 */
export async function changeStage(tx: Prisma.TransactionClient, id: string, userId: string, stageId: string) {
  const [app] = await tx.$queryRaw<{ currentStageId: string }[]>`
    SELECT "currentStageId" FROM "Application" WHERE id = ${id} AND "userId" = ${userId} FOR UPDATE`;
  const target = await tx.stage.findFirst({ where: { id: stageId, userId }, select: { id: true, order: true } });
  if (!app || !target) throw new Error("not found");
  if (app.currentStageId === stageId) return;

  const history = await tx.stageHistory.findMany({
    where: { applicationId: id },
    orderBy: { enteredAt: "asc" },
    select: { id: true, stageId: true, notes: true, result: true, stage: { select: { order: true } } },
  });
  const { drop, append } = planStageChange(
    history.map((h) => ({ id: h.id, stageId: h.stageId, order: h.stage.order, kept: !!h.notes?.trim() || !!h.result })),
    target,
  );
  if (drop.length) await tx.stageHistory.deleteMany({ where: { id: { in: drop } } });
  await tx.application.update({
    where: { id },
    data: { currentStageId: stageId, ...(append && { history: { create: { stageId } } }) },
  });
}
