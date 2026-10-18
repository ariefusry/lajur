import { describe, expect, it } from "vitest";
import { computeDashboard, weeklyCounts, type DashApp, type DashStage } from "./dashboard";
import { DEMO_APPS, demoTimeline } from "./demo-data";
import { STAGE_TEMPLATES } from "./stage-templates";

// Exactly what `pnpm db:seed` creates for the demo account.
const stages: DashStage[] = STAGE_TEMPLATES.BUMN.stages.map((s, order) => ({ id: `s${order}`, name: s.name, order, kind: s.kind }));
const today = new Date("2026-10-18T00:00:00+07:00");
const apps: DashApp[] = DEMO_APPS.map((app, i) => {
  const { appliedAt, history } = demoTimeline(app, i, today);
  return {
    source: app.source,
    resumeId: app.resume === undefined ? null : `cv${app.resume}`,
    currentStageId: `s${app.stage}`,
    appliedAt,
    history: history.map((h) => ({ stageId: `s${h.stageIndex}`, enteredAt: h.enteredAt })),
  };
});
const d = computeDashboard(stages, apps);

/*
 * Hand count from DEMO_APPS (furthest selection stage per app, 1 = Administrasi … 8 = Offering):
 *   Mandiri 3, BRI 2, Telkom 5, Pertamina 1, PLN 2 (ditolak), BCA 4, BNI 3 (ditolak), Tokopedia 6,
 *   Gojek 6 (ditolak), Astra 1, KAI –, BSI 7, Traveloka 8, Angkasa Pura –, eFishery 1 (ditolak)
 */
describe("computeDashboard on the demo data (matches the hand count)", () => {
  it("totals", () => {
    // Current stages: wishlist 2, in progress 8, offering 1, ditolak 4.
    expect(d.totals).toEqual({ applications: 15, wishlist: 2, active: 8, offers: 1, rejected: 4 });
    expect(d.adminStage).toBe("Administrasi");
  });

  it("funnel: applications that reached each stage, with conversion from the previous one", () => {
    expect(d.funnel.map((f) => [f.stage, f.count])).toEqual([
      ["Administrasi", 13],
      ["Tes Online/TPA", 10],
      ["Psikotes", 8],
      ["LGD", 6],
      ["Interview HR", 5],
      ["Interview User", 4],
      ["MCU", 2],
      ["Offering", 1],
    ]);
    expect(d.funnel[0].conversion).toBeNull();
    expect(d.funnel[1].conversion).toBeCloseTo(10 / 13);
    expect(d.funnel[7].conversion).toBeCloseTo(1 / 2);
  });

  it("per source: total and administration pass rate", () => {
    const by = Object.fromEntries(d.bySource.map((s) => [s.key, [s.total, s.reachedAdmin, s.passedAdmin]]));
    expect(by).toEqual({
      BUMN_PORTAL: [6, 5, 4], // Angkasa Pura still wishlist; Pertamina still in Administrasi
      LINKEDIN: [2, 2, 2],
      COMPANY_SITE: [1, 1, 1],
      JOBSTREET: [1, 1, 1],
      REFERRAL: [1, 1, 1],
      KALIBRR: [1, 1, 0],
      INSTAGRAM: [1, 0, 0],
      GLINTS: [1, 1, 1],
      OTHER: [1, 1, 0], // eFishery rejected at Administrasi
    });
    expect(d.bySource.find((s) => s.key === "BUMN_PORTAL")!.rate).toBeCloseTo(0.8);
    expect(d.bySource.find((s) => s.key === "INSTAGRAM")!.rate).toBeNull();
  });

  it("per CV version", () => {
    const by = Object.fromEntries(d.byResume.map((s) => [s.key, [s.total, s.reachedAdmin, s.passedAdmin]]));
    // CV BUMN v1: Mandiri, BRI, Telkom, Pertamina, PLN, BNI, BSI → only Pertamina still in Administrasi.
    // CV Startup v2: BCA, Tokopedia, Gojek, Astra, Traveloka, eFishery → Astra and eFishery stopped at Administrasi.
    expect(by).toEqual({ cv0: [7, 7, 6], cv1: [6, 6, 4] });
  });

  it("where rejections happen", () => {
    // eFishery at Administrasi, PLN at Tes Online, BNI at Psikotes, Gojek at Interview User: one each, pipeline order.
    expect(d.failedAt).toEqual([1, 2, 3, 6].map((i) => ({ stage: stages[i].name, count: 1 })));
  });

  it("median response time", () => {
    // First move after applying = 3 + (i % 5) days for the 11 apps with ≥2 history entries:
    // 3,4,5,7,3,4,5,6,4,5,7 → sorted 3,3,4,4,4,5,5,5,6,7,7 → median 5.
    expect(d.responseTime).toEqual({ medianDays: 5, sample: 11 });
  });
});

describe("computeDashboard edge cases", () => {
  it("empty account", () => {
    const e = computeDashboard(stages, []);
    expect(e.totals.applications).toBe(0);
    expect(e.funnel.every((f) => f.count === 0)).toBe(true);
    expect(e.bySource).toEqual([]);
    expect(e.responseTime).toEqual({ medianDays: null, sample: 0 });
  });
  it("skipped stages still count as reached; even sample count averages the middle pair", () => {
    const skip: DashApp = {
      source: "OTHER", resumeId: null, currentStageId: "s4", appliedAt: new Date("2026-01-01"),
      history: [{ stageId: "s1", enteredAt: new Date("2026-01-01") }, { stageId: "s4", enteredAt: new Date("2026-01-03") }],
    };
    const later = { ...skip, history: [skip.history[0], { stageId: "s2", enteredAt: new Date("2026-01-05") }] };
    const r = computeDashboard(stages, [skip, later]);
    expect(r.funnel.slice(0, 4).map((f) => f.count)).toEqual([2, 2, 1, 1]); // Tes/Psikotes counted for the skipper
    expect(r.responseTime.medianDays).toBe(3); // (2 + 4) / 2
  });
});

describe("weeklyCounts", () => {
  it("buckets by whole weeks back from now, oldest first", () => {
    const now = new Date("2026-10-18T12:00:00Z");
    const ago = (days: number) => new Date(now.getTime() - days * 86_400_000);
    // 0 and 6 days ago = this week; 7 = last week; 27 = 4th week back; 28+ and future dates fall outside 4 weeks.
    expect(weeklyCounts([ago(0), ago(6), ago(7), ago(27), ago(28), ago(-1)], now, 4)).toEqual([1, 0, 1, 2]);
  });
});
