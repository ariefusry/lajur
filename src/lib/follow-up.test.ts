import { describe, expect, it } from "vitest";
import { followUpDate, isFollowUpDue } from "./follow-up";

describe("follow-up dates (Jakarta calendar days)", () => {
  // 23:30 WIB on 18 Oct is already 16:30 UTC; "in 7 days" must still mean 25 Oct WIB.
  const lateEvening = new Date("2026-10-18T23:30:00+07:00");

  it("schedules N days ahead at Jakarta midnight", () => {
    expect(followUpDate(lateEvening, 7).toISOString()).toBe("2026-10-24T17:00:00.000Z"); // 25 Oct 00:00 WIB
  });

  it("is due on the day itself and after, not before", () => {
    const on = (d: string) => new Date(`${d}T00:00:00+07:00`);
    expect(isFollowUpDue(on("2026-10-18"), lateEvening)).toBe(true);
    expect(isFollowUpDue(on("2026-10-10"), lateEvening)).toBe(true);
    expect(isFollowUpDue(on("2026-10-19"), lateEvening)).toBe(false);
    expect(isFollowUpDue(null, lateEvening)).toBe(false);
  });
});
