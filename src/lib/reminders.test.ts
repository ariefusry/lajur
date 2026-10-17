import { describe, expect, it } from "vitest";
import { dueReminder, reminderEmail } from "./reminders";

// Cron runs 07:00 WIB = 00:00 UTC.
const now = new Date("2026-10-17T00:00:00Z");
const at = (iso: string, h3: Date | null = null, h1: Date | null = null) => ({
  startsAt: new Date(iso),
  remindedH3At: h3,
  remindedH1At: h1,
});

describe("dueReminder", () => {
  it("H-1: event tomorrow (Jakarta), even late at night", () => {
    expect(dueReminder(at("2026-10-18T16:59:00Z"), now)).toBe("H1"); // 18 Oct 23:59 WIB
  });
  it("not H-1 once it crosses into the next Jakarta day", () => {
    expect(dueReminder(at("2026-10-18T17:00:00Z"), now)).toBe("H3"); // 19 Oct 00:00 WIB = H-2
  });
  it("H-3 and H-2 send the H-3 reminder", () => {
    expect(dueReminder(at("2026-10-20T03:00:00Z"), now)).toBe("H3");
    expect(dueReminder(at("2026-10-19T03:00:00Z"), now)).toBe("H3");
  });
  it("is idempotent: already reminded → nothing", () => {
    expect(dueReminder(at("2026-10-18T03:00:00Z", null, now), now)).toBeNull();
    expect(dueReminder(at("2026-10-20T03:00:00Z", now), now)).toBeNull();
  });
  it("ignores today, the past, and >3 days out", () => {
    expect(dueReminder(at("2026-10-17T10:00:00Z"), now)).toBeNull();
    expect(dueReminder(at("2026-10-10T10:00:00Z"), now)).toBeNull();
    expect(dueReminder(at("2026-10-21T03:00:00Z"), now)).toBeNull();
  });
});

describe("reminderEmail", () => {
  it("escapes user content in HTML", () => {
    const { html, subject } = reminderEmail(
      "<b>Budi</b>",
      [{ kind: "H1", type: "PSYCHOTEST", startsAt: new Date("2026-10-18T02:00:00Z"), locationOrUrl: null, company: "PT <script>", position: "IT", applicationId: "a1" }],
      "http://localhost:3000",
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>Budi");
    expect(html).toContain("09.00");
    expect(subject).toContain("besok");
  });
});
