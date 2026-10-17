import type { JobSource, StageKind } from "@/generated/prisma/enums";

export type DashStage = { id: string; name: string; order: number; kind: StageKind };
export type DashApp = {
  source: JobSource;
  resumeId: string | null;
  currentStageId: string;
  appliedAt: Date | null;
  history: { stageId: string; enteredAt: Date }[];
};

export type PassRate = { total: number; reachedAdmin: number; passedAdmin: number; rate: number | null };

const DAY_MS = 86_400_000;

function median(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * All dashboard numbers, computed on the server from the user's stages and applications (CLAUDE.md 7.7).
 * "Reached stage X" = the furthest selection stage (IN_PROGRESS/OFFER) in the application's history is at or
 * past X; Ditolak/Withdrawn don't count as progress. The administration stage is the first selection stage.
 */
export function computeDashboard(stages: DashStage[], apps: DashApp[]) {
  const pipeline = stages.filter((s) => s.kind === "IN_PROGRESS" || s.kind === "OFFER").sort((a, b) => a.order - b.order);
  const orderOf = new Map(pipeline.map((s) => [s.id, s.order]));
  const kindOf = new Map(stages.map((s) => [s.id, s.kind]));
  const furthest = (a: DashApp) => {
    const orders = a.history.map((h) => orderOf.get(h.stageId)).filter((o): o is number => o !== undefined);
    return orders.length ? Math.max(...orders) : null;
  };
  const reachedOf = apps.map(furthest);

  const counts = pipeline.map((stage) => reachedOf.filter((r) => r !== null && r >= stage.order).length);
  const funnel = pipeline.map((stage, i) => ({
    stage: stage.name,
    count: counts[i],
    // Share of the previous stage that made it here.
    conversion: i === 0 || !counts[i - 1] ? null : counts[i] / counts[i - 1],
  }));

  const admin = pipeline[0];
  const passRate = (subset: number[]): PassRate => {
    const reached = subset.filter((i) => admin && reachedOf[i] !== null && reachedOf[i]! >= admin.order);
    const passed = reached.filter((i) => reachedOf[i]! > admin.order);
    return {
      total: subset.length,
      reachedAdmin: reached.length,
      passedAdmin: passed.length,
      rate: reached.length ? passed.length / reached.length : null,
    };
  };
  const groupBy = <K>(key: (a: DashApp) => K | null) => {
    const groups = new Map<K, number[]>();
    apps.forEach((a, i) => {
      const k = key(a);
      if (k === null) return;
      groups.set(k, [...(groups.get(k) ?? []), i]);
    });
    return [...groups].map(([k, idx]) => ({ key: k, ...passRate(idx) })).sort((a, b) => b.total - a.total);
  };

  // Days from applying to the first stage change after the initial entry.
  const responseDays = apps.flatMap((a) => {
    if (!a.appliedAt) return [];
    const moves = [...a.history].sort((x, y) => x.enteredAt.getTime() - y.enteredAt.getTime());
    if (moves.length < 2) return [];
    const days = (moves[1].enteredAt.getTime() - a.appliedAt.getTime()) / DAY_MS;
    return days >= 0 ? [days] : [];
  });

  const currentKinds = apps.map((a) => kindOf.get(a.currentStageId));
  return {
    totals: {
      applications: apps.length,
      active: currentKinds.filter((k) => k === "IN_PROGRESS").length,
      offers: currentKinds.filter((k) => k === "OFFER").length,
      rejected: currentKinds.filter((k) => k === "REJECTED" || k === "WITHDRAWN").length,
    },
    adminStage: admin?.name ?? null,
    funnel,
    bySource: groupBy((a) => a.source),
    byResume: groupBy((a) => a.resumeId),
    responseTime: { medianDays: median(responseDays), sample: responseDays.length },
  };
}
