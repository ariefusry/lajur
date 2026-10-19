import { describe, expect, it } from "vitest";
import { EMAIL_FIXTURES } from "./fixtures";
import {
  EMAIL_SYSTEM,
  MAX_EMAIL_TEXT,
  normalizeEmailText,
  parseWib,
  verifyReading,
  type EmailReading,
} from "./reading";

const base: EmailReading = {
  company: "Acme",
  companyQuote: "PT Acme Indonesia",
  position: null,
  kind: "TEST_INVITE",
  kindQuote: "Online Entry Test",
  stageName: "Online Entry Test",
  events: [],
  notes: [],
  sourceUrl: null,
};
const text = "Halo [NAME_1],\nPT Acme Indonesia mengundang\nOnline Entry Test.\nTest Closes: 24 Sep 2026 11:00 WIB";

describe("parseWib", () => {
  it("reads a date as 23.59 WIB and a datetime as that hour WIB", () => {
    expect(parseWib("2026-09-24")?.toISOString()).toBe("2026-09-24T16:59:00.000Z");
    expect(parseWib("2026-10-01T09:00")?.toISOString()).toBe("2026-10-01T02:00:00.000Z");
  });
  it("rejects anything else", () => {
    expect(parseWib("1 Okt")).toBeNull();
    expect(parseWib("2026-10-01T24:00")).toBeNull();
    expect(parseWib("2026-02-30")).toBeNull();
  });
});

describe("normalizeEmailText", () => {
  it("tidies whitespace and caps the length", () => {
    expect(normalizeEmailText("a \t b\r\n\r\n\r\n\r\nc  ")).toBe("a b\n\nc");
    expect(normalizeEmailText("x".repeat(MAX_EMAIL_TEXT + 5))).toHaveLength(MAX_EMAIL_TEXT);
  });
});

describe("verifyReading", () => {
  const ev = (quote: string, closesAt: string) => ({ type: "ONLINE_TEST" as const, opensAt: null, closesAt, quote });
  const win = "Test Closes: 24 Sep 2026 11:00 WIB";
  it("drops events with an invented quote or an unparseable time", () => {
    const r = verifyReading(
      { ...base, events: [ev(win, "2026-09-24T11:00"), ev("dibuat-buat 24", "2026-09-24"), ev(win, "1 Okt")] },
      text,
    );
    expect(r.events.map((e) => e.closesAt)).toEqual(["2026-09-24T11:00"]);
  });
  it("drops a real quote carrying a different date", () => {
    expect(verifyReading({ ...base, events: [ev(win, "2026-09-25T11:00")] }, text).events).toHaveLength(0);
  });
  it("keeps quotes that differ only in whitespace or line breaks", () => {
    const r = verifyReading({ ...base, events: [ev("Test  Closes:\n24 Sep 2026", "2026-09-24")] }, text);
    expect(r.events).toHaveLength(1);
  });
  const win2 = `${text}
Test Open: 17 Sep 2026 08:00 WIB`;
  const w = (opensAt: string) => ({ ...ev(win, "2026-09-24T11:00"), opensAt });
  it("keeps opensAt for a window whose quote has only the close line", () => {
    expect(verifyReading({ ...base, events: [w("2026-09-17T08:00")] }, win2).events[0].opensAt).toBe(
      "2026-09-17T08:00",
    );
  });
  it("nulls a reversed opensAt but keeps the event", () => {
    const r = verifyReading(
      { ...base, events: [w("2026-09-25T08:00")] },
      `${win2}
25 Sep`,
    );
    expect(r.events).toHaveLength(1);
    expect(r.events[0].opensAt).toBeNull();
  });
  it("nulls an opensAt whose day is nowhere in the email, or unparseable", () => {
    expect(verifyReading({ ...base, events: [w("2026-09-17T08:00")] }, text).events[0].opensAt).toBeNull();
    expect(verifyReading({ ...base, events: [w("kemarin")] }, text).events[0].opensAt).toBeNull();
  });
  it("nulls position, stageName and sourceUrl that are not in the email", () => {
    const r = verifyReading(
      { ...base, position: "Dev", stageName: "Online Assessment", sourceUrl: "https://x.id" },
      text,
    );
    expect([r.position, r.stageName, r.sourceUrl]).toEqual([null, null, null]);
  });
  it("keeps position, stageName and a placeholder link that are in the email", () => {
    const t2 = `${text}
Posisi: Data Analyst
Link: [URL_1]`;
    const r = verifyReading({ ...base, position: "Data Analyst", sourceUrl: "[URL_1]" }, t2);
    expect([r.position, r.stageName, r.sourceUrl]).toEqual(["Data Analyst", "Online Entry Test", "[URL_1]"]);
  });
  it("nulls company and falls back to OTHER when the quote is missing", () => {
    const r = verifyReading({ ...base, companyQuote: "PT Lain", kindQuote: "tidak ada" }, text);
    expect(r.company).toBeNull();
    expect(r.companyQuote).toBeNull();
    expect(r.kind).toBe("OTHER");
  });
  it("keeps verified company and kind", () => {
    const r = verifyReading(base, text);
    expect(r.company).toBe("Acme");
    expect(r.kind).toBe("TEST_INVITE");
  });
});

describe("EMAIL_SYSTEM", () => {
  it("covers the key rules", () => {
    for (const w of ["WIB", "opensAt", "closesAt", "[CRED_1]", "REJECTION", "APPLICATION_RECEIVED"])
      expect(EMAIL_SYSTEM).toContain(w);
  });
  it("fixtures are usable as input", () => {
    expect(EMAIL_FIXTURES.length).toBeGreaterThan(0);
  });
});
