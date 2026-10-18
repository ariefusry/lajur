import type { JobSource, StageKind } from "@/generated/prisma/enums";

export type DashStage = { id: string; name: string; order: number; kind: StageKind };
export type DashApp = {
  source: JobSource;
  resumeId: string | null;
  currentStageId: string;
  appliedAt: Date | null;
  history: { stageId: string; enteredAt: Date }[];
};

export type PassRate = {
  total: number;
  /** Applications that were actually sent (reached a selection stage). */
  applied: number;
  /** ...of which the company reacted (any stage change after applying, rejection included). */
  responded: number;
  reachedAdmin: number;
  passedAdmin: number;
  rate: number | null;
};

const DAY_MS = 86_400_000;
/** An active application with no news for this long counts as ghosted (derived, never stored). */
export const GHOSTED_DAYS = 30;
/** Early warning: no news for this long, not yet ghosted. */
export const QUIET_DAYS = 14;
/** Below this many applications a percentage says more about luck than strategy: show counts only. */
export const MIN_SAMPLE = 5;
/** Interview stages are recognised by name, since stage kinds don't distinguish them. */
const INTERVIEW = /interview|wawancara/i;

function median(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** `count / of`, or null when the sample is too small to mean anything. */
export const rate = (count: number, of: number) => (of >= MIN_SAMPLE ? count / of : null);

export type AppFacts = {
  /** When it was sent: the application date, else when it first entered a selection stage. Null = still wishlist. */
  appliedOn: Date | null;
  /** First stage change after applying (the company's first reaction). */
  respondedOn: Date | null;
  interviewed: boolean;
  offered: boolean;
  kind: StageKind | undefined;
  /** Whole days since anything last happened (stage change or application date). */
  idleDays: number;
  /** Active (in a selection stage) with no news for GHOSTED_DAYS. */
  ghosted: boolean;
  /** Active, no news for QUIET_DAYS but not yet ghosted. */
  quiet: boolean;
};

/** Per-application facts the dashboard, analytics, list and board all agree on. */
export function appFactsFor(stages: DashStage[], now: Date) {
  const byId = new Map(stages.map((s) => [s.id, s]));
  const isPipeline = (id: string) => {
    const k = byId.get(id)?.kind;
    return k === "IN_PROGRESS" || k === "OFFER";
  };
  return (a: Pick<DashApp, "currentStageId" | "appliedAt" | "history">): AppFacts => {
    const moves = [...a.history].sort((x, y) => x.enteredAt.getTime() - y.enteredAt.getTime());
    const firstPipeline = moves.findIndex((h) => isPipeline(h.stageId));
    const appliedOn = a.appliedAt ?? (firstPipeline === -1 ? null : moves[firstPipeline].enteredAt);
    const respondedOn = firstPipeline === -1 ? null : (moves[firstPipeline + 1]?.enteredAt ?? null);
    const last = Math.max(a.appliedAt?.getTime() ?? 0, ...moves.map((h) => h.enteredAt.getTime()));
    const idleDays = Math.floor((now.getTime() - last) / DAY_MS);
    const kind = byId.get(a.currentStageId)?.kind;
    const active = kind === "IN_PROGRESS";
    return {
      appliedOn,
      respondedOn,
      interviewed: moves.some((h) => INTERVIEW.test(byId.get(h.stageId)?.name ?? "")),
      offered: moves.some((h) => byId.get(h.stageId)?.kind === "OFFER"),
      kind,
      idleDays,
      ghosted: active && idleDays >= GHOSTED_DAYS,
      quiet: active && idleDays >= QUIET_DAYS && idleDays < GHOSTED_DAYS,
    };
  };
}

/**
 * All dashboard and analytics numbers, computed on the server from the user's stages and applications.
 * "Reached stage X" = the furthest selection stage (IN_PROGRESS/OFFER) in the application's history is at or
 * past X; Ditolak/Withdrawn don't count as progress. The administration stage is the first selection stage.
 */
export function computeDashboard(stages: DashStage[], apps: DashApp[], now = new Date()) {
  const pipeline = stages.filter((s) => s.kind === "IN_PROGRESS" || s.kind === "OFFER").sort((a, b) => a.order - b.order);
  const orderOf = new Map(pipeline.map((s) => [s.id, s.order]));
  const kindOf = new Map(stages.map((s) => [s.id, s.kind]));
  const furthest = (a: DashApp) => {
    const orders = a.history.map((h) => orderOf.get(h.stageId)).filter((o): o is number => o !== undefined);
    return orders.length ? Math.max(...orders) : null;
  };
  const reachedOf = apps.map(furthest);
  const facts = apps.map(appFactsFor(stages, now));

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
    const applied = subset.filter((i) => facts[i].appliedOn);
    return {
      total: subset.length,
      applied: applied.length,
      responded: applied.filter((i) => facts[i].respondedOn).length,
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

  // Days from applying to the company's first reaction.
  const responseDays = facts.flatMap((f) => {
    if (!f.appliedOn || !f.respondedOn) return [];
    const days = (f.respondedOn.getTime() - f.appliedOn.getTime()) / DAY_MS;
    return days >= 0 ? [days] : [];
  });

  // Where rejected applications stopped: their furthest selection stage.
  const failedAt = pipeline
    .map((stage) => ({
      stage: stage.name,
      count: apps.filter((a, i) => kindOf.get(a.currentStageId) === "REJECTED" && reachedOf[i] === stage.order).length,
    }))
    .filter((f) => f.count > 0)
    .sort((a, b) => b.count - a.count);

  const applied = facts.filter((f) => f.appliedOn);
  const currentKinds = apps.map((a) => kindOf.get(a.currentStageId));
  const ghosted = facts.filter((f) => f.ghosted).length;
  return {
    totals: {
      applications: apps.length,
      wishlist: currentKinds.filter((k) => k === "WISHLIST").length,
      active: currentKinds.filter((k) => k === "IN_PROGRESS").length,
      ghosted,
      offers: currentKinds.filter((k) => k === "OFFER").length,
      rejected: currentKinds.filter((k) => k === "REJECTED" || k === "WITHDRAWN").length,
    },
    /** Counts over sent applications, so the UI can show "3 dari 40" next to every rate. */
    outcomes: {
      applied: applied.length,
      responded: applied.filter((f) => f.respondedOn).length,
      interviewed: applied.filter((f) => f.interviewed).length,
      offered: applied.filter((f) => f.offered).length,
      ghosted,
      /** Still active and the company hasn't reacted yet (ghosted ones excluded). */
      waiting: facts.filter((f) => f.kind === "IN_PROGRESS" && !f.ghosted && !f.respondedOn).length,
    },
    adminStage: admin?.name ?? null,
    funnel,
    failedAt,
    bySource: groupBy((a) => a.source),
    byResume: groupBy((a) => a.resumeId),
    responseTime: { medianDays: median(responseDays), sample: responseDays.length },
  };
}

/** Applications per week for the last `weeks` weeks, oldest first (index weeks-1 = the 7 days up to `now`). */
export function weeklyCounts(dates: Date[], now: Date, weeks = 12) {
  const counts = Array<number>(weeks).fill(0);
  for (const d of dates) {
    const ago = Math.floor((now.getTime() - d.getTime()) / (7 * DAY_MS));
    if (ago >= 0 && ago < weeks) counts[weeks - 1 - ago]++;
  }
  return counts;
}
