import { describe, expect, it } from "vitest";
import { redactPII } from "../ai/redact";
import { EMAIL_FIXTURES } from "./fixtures";
import {
  EMAIL_SYSTEM,
  MAX_EMAIL_TEXT,
  normalizeEmailText,
  parseWib,
  rehydrateReading,
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
  sentAt: null,
  sentQuote: null,
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
  it("nulls a company that is neither quoted nor written, and falls back to OTHER without a kind quote", () => {
    const r = verifyReading({ ...base, company: "Lain", companyQuote: "PT Lain", kindQuote: "tidak ada" }, text);
    expect(r.company).toBeNull();
    expect(r.companyQuote).toBeNull();
    expect(r.kind).toBe("OTHER");
  });
  it("nulls an invented company even when its quote is real, and keeps one its quote contains", () => {
    const r = verifyReading({ ...base, company: "Globex", companyQuote: "PT Acme Indonesia" }, text);
    expect(r.company).toBeNull();
    expect(r.companyQuote).toBe("PT Acme Indonesia");
    const shortened = { ...base, company: "Acme Indonesia", companyQuote: "PT Acme Indonesia mengundang" };
    expect(verifyReading(shortened, text).company).toBe("Acme Indonesia");
  });
  it("empties a kind quote that is not in the email", () => {
    expect(verifyReading({ ...base, kindQuote: "kami mengundang Anda" }, text).kindQuote).toBe("");
    expect(verifyReading(base, text).kindQuote).toBe("Online Entry Test");
  });
  it("keeps verified company and kind", () => {
    const r = verifyReading(base, text);
    expect(r.company).toBe("Acme");
    expect(r.kind).toBe("TEST_INVITE");
  });
});

// Answer shapes seen in live runs (pnpm ai:email) against the fixtures.
describe("verifyReading sent date", () => {
  const now = new Date("2026-10-20T03:00:00Z");
  const withHeader = "Date: Fri, Sep 18, 2026 at 3:22 PM\n" + text;
  const sent = (sentAt: string, sentQuote: string) => ({ ...base, sentAt, sentQuote });

  it("keeps a date backed by a header line, with or without a year", () => {
    const r = verifyReading(sent("2026-09-18T15:22", "Date: Fri, Sep 18, 2026 at 3:22 PM"), withHeader, now);
    expect(r.sentAt).toBe("2026-09-18T15:22");
    const noYear = "Fri, Sep 18, 3:22 PM\n" + text;
    expect(verifyReading(sent("2026-09-18", "Fri, Sep 18, 3:22 PM"), noYear, now).sentAt).toBe("2026-09-18");
  });

  it("drops an invented quote, a different day, a different year, the future and an unparseable date", () => {
    expect(verifyReading(sent("2026-09-18", "Date: tidak ada 18"), text, now).sentAt).toBeNull();
    expect(verifyReading(sent("2026-09-19", "Date: Fri, Sep 18, 2026 at 3:22 PM"), withHeader, now).sentAt).toBeNull();
    expect(verifyReading(sent("2025-09-18", "Date: Fri, Sep 18, 2026 at 3:22 PM"), withHeader, now).sentAt).toBeNull();
    const future = "Date: Dec 18, 2026\n" + text;
    expect(verifyReading(sent("2026-12-18", "Date: Dec 18, 2026"), future, now).sentAt).toBeNull();
    expect(verifyReading(sent("18 Sep", "Date: Fri, Sep 18, 2026 at 3:22 PM"), withHeader, now).sentAt).toBeNull();
    expect(
      verifyReading(sent("2026-09-18", "Date: Fri, Sep 18, 2026 at 3:22 PM"), withHeader, now).sentQuote,
    ).not.toBeNull();
    expect(
      verifyReading(sent("2026-09-19", "Date: Fri, Sep 18, 2026 at 3:22 PM"), withHeader, now).sentQuote,
    ).toBeNull();
  });
});

describe("verifyReading on live answer shapes", () => {
  const fixture = (start: string) => normalizeEmailText(EMAIL_FIXTURES.find((f) => f.name.startsWith(start))!.text);

  it("keeps a company written in the email when the model left companyQuote null", () => {
    const bni = { ...base, company: "BNI", companyQuote: null, kindQuote: "tidak dapat melanjutkan" };
    expect(verifyReading(bni, fixture("BNI")).company).toBe("BNI");
    const apple = { ...base, company: "Apple Developer Academy Indonesia", companyQuote: null };
    expect(verifyReading(apple, fixture("Apple")).company).toBe("Apple Developer Academy Indonesia");
  });

  it("still nulls a company that is not written in the email", () => {
    const r = verifyReading({ ...base, company: "Bank Negara Indonesia", companyQuote: null }, fixture("BNI"));
    expect(r.company).toBeNull();
  });

  const appleWindow = (quote: string) => ({
    ...base,
    events: [{ type: "ONLINE_TEST" as const, opensAt: "2026-09-17T08:00", closesAt: "2026-09-24T11:00", quote }],
  });

  it("keeps a window quoted by its opening line, extending the quote to the closing line below it", () => {
    const r = verifyReading(appleWindow("Test Open : September 17, 2026 - 08:00 WIB (GMT+7)"), fixture("Apple"));
    expect(r.events).toHaveLength(1);
    expect(r.events[0].quote).toBe(
      "Test Open : September 17, 2026 - 08:00 WIB (GMT+7)\nTest Closes : September 24, 2026 - 11:00 WIB (GMT+7)",
    );
    expect(r.events[0].opensAt).toBe("2026-09-17T08:00");
  });

  it("drops a close-only copy of a window", () => {
    const window = appleWindow("Test Open : September 17, 2026 - 08:00 WIB (GMT+7)");
    const closeOnly = { ...window.events[0], opensAt: null, quote: "Test Closes : September 24, 2026 - 11:00 WIB" };
    const r = verifyReading({ ...window, events: [...window.events, closeOnly] }, fixture("Apple"));
    expect(r.events.map((e) => e.opensAt)).toEqual(["2026-09-17T08:00"]);
  });

  it("still drops a window whose quote and the line below lack the closing day", () => {
    const r = verifyReading(appleWindow("Test Duration: 120 minutes"), fixture("Apple"));
    expect(r.events).toHaveLength(0);
  });

  it("falls back to OTHER on the empty kindQuote the prompt asks for instead of null", () => {
    // Groq's strict schema rejects a null kindQuote outright, so the prompt asks for "" instead.
    expect(EMAIL_SYSTEM).toContain('isi "" (string kosong), jangan null');
    const raw = { ...base, kind: "DOCUMENT_REQUEST" as const, kindQuote: "" };
    expect(verifyReading(raw, fixture("ISS")).kind).toBe("OTHER");
  });

  it("keeps APPLICATION_RECEIVED without a quote when the company or link is in the email", () => {
    const astra = {
      ...base,
      company: "PT Global Service Indonesia",
      companyQuote: null,
      position: "Mobile Developer - GSI",
      kind: "APPLICATION_RECEIVED" as const,
      kindQuote: "",
      stageName: null,
    };
    const r = verifyReading(astra, fixture("Astra"));
    expect([r.kind, r.company, r.position]).toEqual([
      "APPLICATION_RECEIVED",
      "PT Global Service Indonesia",
      "Mobile Developer - GSI",
    ]);
    const made = { ...astra, company: "PT Lain", position: "Lain" };
    expect(verifyReading(made, fixture("Astra")).kind).toBe("OTHER");
  });

  it("reads the portal table as APPLICATION_RECEIVED when the model called it OTHER", () => {
    const astra = {
      ...base,
      company: "PT Global Service Indonesia",
      companyQuote: "PT Global Service Indonesia",
      position: "Mobile Developer - GSI",
      kind: "OTHER" as const,
      kindQuote: "",
      stageName: null,
      sourceUrl: "[URL_1]",
    };
    const astraText = redactPII(fixture("Astra")).text;
    expect(verifyReading(astra, astraText)).toMatchObject({
      kind: "APPLICATION_RECEIVED",
      company: "PT Global Service Indonesia",
      position: "Mobile Developer - GSI",
      sourceUrl: "[URL_1]",
    });
    // A company alone is not that table.
    expect(verifyReading({ ...astra, position: null, sourceUrl: null }, astraText).kind).toBe("OTHER");
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

describe("rehydrateReading", () => {
  it("puts the originals back in every text field, leaving dates alone", () => {
    const map = { "[URL_1]": "https://tes.id/a", "[CRED_1]": "budi01", "[NAME_1]": "Budi" };
    const r = rehydrateReading(
      {
        ...base,
        kindQuote: "Halo [NAME_1], undangan tes",
        events: [{ type: "ONLINE_TEST", opensAt: null, closesAt: "2026-09-24", quote: "[NAME_1] 24 September 2026" }],
        notes: ["Link: [URL_1]", "Username: [CRED_1]", "Password: [CRED_9]"],
        sourceUrl: "[URL_1]",
      },
      map,
    );
    expect(r.kindQuote).toBe("Halo Budi, undangan tes");
    expect(r.events[0]).toEqual({
      type: "ONLINE_TEST",
      opensAt: null,
      closesAt: "2026-09-24",
      quote: "Budi 24 September 2026",
    });
    expect(r.notes).toEqual(["Link: https://tes.id/a", "Username: budi01", "Password: [CRED_9]"]);
    expect(r.sourceUrl).toBe("https://tes.id/a");
    expect(r.position).toBeNull();
  });
});
