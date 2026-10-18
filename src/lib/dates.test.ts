import { describe, expect, it } from "vitest";
import { daysUntil } from "./dates";

describe("daysUntil", () => {
  // 2026-10-17 23:30 WIB = 16:30 UTC; still the 17th in Jakarta.
  const now = new Date("2026-10-17T16:30:00Z");
  it("counts Jakarta calendar days", () => {
    expect(daysUntil(new Date("2026-10-17T17:00:00Z"), now)).toBe(1); // 18 Oct 00:00 WIB
    expect(daysUntil(new Date("2026-10-20T17:00:00Z"), now)).toBe(4);
    expect(daysUntil(new Date("2026-10-15T17:00:00Z"), now)).toBe(-1);
  });
});
