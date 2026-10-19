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
  it("drops events with an invented quote or an unparseable time", () => {
    const r = verifyReading(
      {
        ...base,
        events: [
          ev("Test Closes: 24 Sep 2026 11:00 WIB", "2026-09-24T11:00"),
          ev("dibuat-buat", "2026-09-24"),
          ev("Online Entry Test", "1 Okt"),
        ],
      },
      text,
    );
    expect(r.events).toHaveLength(1);
    expect(r.events[0].closesAt).toBe("2026-09-24T11:00");
  });
  it("drops an event whose opensAt is unparseable", () => {
    const r = verifyReading(
      { ...base, events: [{ ...ev("Online Entry Test", "2026-09-24"), opensAt: "kemarin" }] },
      text,
    );
    expect(r.events).toHaveLength(0);
  });
  it("keeps quotes that differ only in whitespace or line breaks", () => {
    const r = verifyReading({ ...base, events: [ev("mengundang Online   Entry Test.", "2026-09-24")] }, text);
    expect(r.events).toHaveLength(1);
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
