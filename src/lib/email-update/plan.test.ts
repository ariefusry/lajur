import { describe, expect, it } from "vitest";
import { EMAIL_FIXTURES } from "./fixtures";
import { appendNotes, matchApplications, normalizeCompany, planEmailUpdate, summarizePlan } from "./plan";
import { formatDate } from "../dates";
import type { EmailReading } from "./reading";
import { STAGE_TEMPLATES } from "../stage-templates";

const bumn = STAGE_TEMPLATES.BUMN.stages.map((s, order) => ({ ...s, order, id: s.name }));
const startup = STAGE_TEMPLATES.STARTUP.stages.map((s, order) => ({ ...s, order, id: s.name }));

const reading = (r: Partial<EmailReading>): EmailReading => ({
  company: null,
  companyQuote: null,
  position: null,
  kind: "OTHER",
  kindQuote: "",
  stageName: null,
  events: [],
  notes: [],
  sourceUrl: null,
  ...r,
});

// An application in Administrasi with the default history.
const atAdm = {
  currentStageId: "Administrasi",
  history: [
    { stageId: "Wishlist", result: null },
    { stageId: "Administrasi", result: null },
  ],
  events: [],
};

const peepl = reading({
  company: "Peepl",
  kind: "TEST_INVITE",
  events: [{ type: "ONLINE_TEST", opensAt: "2026-09-29T14:00", closesAt: "2026-10-01T09:00", quote: "Selesai" }],
  notes: ["Link: [URL_1]", "Username: [CRED_1]", "Password: [CRED_2]"],
  sourceUrl: "[URL_1]",
});

describe("normalizeCompany", () => {
  it("drops PT, Tbk, (Persero) and punctuation", () => {
    expect(normalizeCompany("PT Bank Negara Indonesia (Persero) Tbk.")).toBe("bank negara indonesia");
    expect(normalizeCompany("  PT. Global-Service  Indonesia ")).toBe("global service indonesia");
  });
});

describe("matchApplications", () => {
  it("matches after normalising, either way round", () => {
    expect(
      matchApplications("PT ISS Indonesia", [
        { id: "a", company: "ISS Indonesia" },
        { id: "b", company: "PT Indosat" },
      ]),
    ).toEqual(["a"]);
    expect(
      matchApplications("PT Bank Negara Indonesia (Persero) Tbk", [{ id: "x", company: "Bank Negara Indonesia" }]),
    ).toEqual(["x"]);
    expect(matchApplications("ISS", [{ id: "a", company: "PT ISS Indonesia" }])).toEqual(["a"]);
  });

  it("ranks an exact match above a partial one", () => {
    const apps = [
      { id: "partial", company: "Astra Honda Motor" },
      { id: "exact", company: "PT Astra" },
    ];
    expect(matchApplications("Astra", apps)).toEqual(["exact", "partial"]);
  });

  it("ignores missing, short and in-word matches", () => {
    expect(matchApplications(null, [{ id: "a", company: "ISS Indonesia" }])).toEqual([]);
    expect(matchApplications("PT AB", [{ id: "a", company: "AB Mart" }])).toEqual([]);
    expect(matchApplications("Indo", [{ id: "a", company: "Indosat" }])).toEqual([]);
  });
});

describe("planEmailUpdate", () => {
  it("Peepl: moves to the test stage and adds the window and notes", () => {
    expect(planEmailUpdate(peepl, { stages: bumn, app: atAdm })).toEqual([
      { id: "move", kind: "move", stageId: "Tes Online/TPA", quote: "" },
      {
        id: "event-0",
        kind: "event",
        type: "ONLINE_TEST",
        startsAt: "2026-10-01T02:00:00.000Z",
        opensAt: "2026-09-29T07:00:00.000Z",
        locationOrUrl: "[URL_1]",
        quote: "Selesai",
      },
      { id: "notes", kind: "notes", text: "- Link: [URL_1]\n- Username: [CRED_1]\n- Password: [CRED_2]" },
    ]);
  });

  it("ISS: a document request adds a 23.59 WIB deadline and no move", () => {
    const iss = reading({
      kind: "DOCUMENT_REQUEST",
      events: [{ type: "DEADLINE", opensAt: null, closesAt: "2026-09-24", quote: "24th September 2026" }],
    });
    const changes = planEmailUpdate(iss, { stages: bumn, app: atAdm });
    expect(changes.map((c) => c.kind)).toEqual(["event"]);
    expect(changes[0]).toMatchObject({ type: "DEADLINE", startsAt: "2026-09-24T16:59:00.000Z", opensAt: null });
  });

  it("BNI: rejection moves to Ditolak and fails the named stage, with no events", () => {
    for (const stageName of ["Online Assessment", "Online Assesment"]) {
      const bni = reading({
        kind: "REJECTION",
        kindQuote: "tidak dapat melanjutkan",
        stageName,
        events: [{ type: "OTHER", opensAt: null, closesAt: "2026-09-15", quote: "Sep 15" }],
      });
      expect(planEmailUpdate(bni, { stages: bumn, app: atAdm })).toEqual([
        { id: "move", kind: "move", stageId: "Ditolak", quote: "tidak dapat melanjutkan" },
        { id: "fail", kind: "fail", stageId: "Tes Online/TPA", quote: stageName },
      ]);
    }
  });

  it("rejection without a stage fails the last step, unless it already has a result", () => {
    const rej = reading({ kind: "REJECTION", kindQuote: "tidak lolos" });
    expect(planEmailUpdate(rej, { stages: bumn, app: atAdm })).toContainEqual({
      id: "fail",
      kind: "fail",
      stageId: "Administrasi",
      quote: "tidak lolos",
    });
    const passed = { ...atAdm, history: [atAdm.history[0], { stageId: "Administrasi", result: "PASSED" as const }] };
    expect(planEmailUpdate(rej, { stages: bumn, app: passed }).map((c) => c.kind)).toEqual(["move"]);
    // Already in Ditolak: the step before it is the one that failed, and there is nothing to move.
    const rejected = {
      ...atAdm,
      currentStageId: "Ditolak",
      history: [...atAdm.history, { stageId: "Ditolak", result: null }],
    };
    expect(planEmailUpdate(rej, { stages: bumn, app: rejected })).toEqual([
      { id: "fail", kind: "fail", stageId: "Administrasi", quote: "tidak lolos" },
    ]);
  });

  it("skips an event the application already has", () => {
    const startsAt = new Date("2026-10-01T02:00:00.000Z");
    const app = {
      ...atAdm,
      events: [{ type: "ONLINE_TEST" as const, startsAt, opensAt: new Date("2026-09-29T07:00:00.000Z") }],
    };
    expect(planEmailUpdate(peepl, { stages: bumn, app }).map((c) => c.kind)).toEqual(["move", "notes"]);
    // Same close time without the open time: the email adds the window, so it is still proposed.
    const closeOnly = { ...atAdm, events: [{ type: "ONLINE_TEST" as const, startsAt, opensAt: null }] };
    expect(planEmailUpdate(peepl, { stages: bumn, app: closeOnly }).map((c) => c.kind)).toEqual([
      "move",
      "event",
      "notes",
    ]);
  });

  it("does not move to the current stage", () => {
    const app = { ...atAdm, currentStageId: "Tes Online/TPA" };
    expect(planEmailUpdate(peepl, { stages: bumn, app }).map((c) => c.kind)).toEqual(["event", "notes"]);
  });

  it("maps stage names through the synonym table", () => {
    const target = (stageName: string, stages = bumn) =>
      planEmailUpdate(reading({ kind: "OTHER", stageName }), { stages, app: atAdm }).find((c) => c.kind === "move")
        ?.stageId;
    expect(target("Psikotes Online")).toBe("Psikotes");
    expect(target("Psychological Test")).toBe("Psikotes");
    expect(target("Leaderless Group Discussion")).toBe("LGD");
    expect(target("User Interview")).toBe("Interview User");
    expect(target("Wawancara HR")).toBe("Interview HR");
    expect(target("Medical Check Up")).toBe("MCU");
    expect(target("TPA")).toBe("Tes Online/TPA");
    expect(target("Online Test", startup)).toBe("Technical Test");
    expect(target("Unknown Step")).toBeUndefined();
  });

  it("falls back to the kind when the stage name matches nothing", () => {
    const target = (r: Partial<EmailReading>) => planEmailUpdate(reading(r), { stages: bumn, app: atAdm })[0];
    const at = { opensAt: null, closesAt: "2026-10-01", quote: "1 Oktober 2026" };
    expect(target({ kind: "TEST_INVITE", events: [{ type: "PSYCHOTEST", ...at }] })).toMatchObject({
      stageId: "Psikotes",
    });
    expect(target({ kind: "INTERVIEW" })).toMatchObject({ stageId: "Interview HR" });
    expect(target({ kind: "MCU" })).toMatchObject({ stageId: "MCU" });
    expect(target({ kind: "OFFER" })).toMatchObject({ stageId: "Offering" });
    expect(target({ kind: "APPLICATION_RECEIVED" })).toBeUndefined();
  });

  it("plans without an application", () => {
    expect(planEmailUpdate(peepl, { stages: bumn, app: null }).map((c) => c.kind)).toEqual(["move", "event", "notes"]);
  });
});

describe("fixture expectations", () => {
  it("every fixture has an expected plan", () => {
    for (const f of EMAIL_FIXTURES) expect(f.expect, f.name).toBeDefined();
  });

  it("summarizes a plan in the fixtures' shape", () => {
    const bni = reading({ kind: "REJECTION", stageName: "Online Assesment" });
    expect(summarizePlan(bni, planEmailUpdate(bni, { stages: bumn, app: atAdm }), bumn)).toEqual(
      EMAIL_FIXTURES.find((f) => f.name.startsWith("BNI"))!.expect,
    );
    expect(summarizePlan(peepl, planEmailUpdate(peepl, { stages: bumn, app: atAdm }), bumn)).toEqual(
      EMAIL_FIXTURES.find((f) => f.name.startsWith("Peepl"))!.expect,
    );
  });
});

describe("appendNotes", () => {
  const today = new Date("2026-10-19T03:00:00Z");
  const date = formatDate(today);

  it("starts empty notes with the date", () => {
    expect(appendNotes(null, "- Login: abc", today)).toBe(`${date}\n- Login: abc`);
    expect(appendNotes("  ", "- Login: abc", today)).toBe(`${date}\n- Login: abc`);
  });

  it("appends below existing notes, never replacing them", () => {
    expect(appendNotes("Pertanyaan: kenapa BUMN?", "- Bawa KTP", today)).toBe(
      `Pertanyaan: kenapa BUMN?\n\n${date}\n- Bawa KTP`,
    );
  });
});
