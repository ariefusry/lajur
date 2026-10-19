import { describe, expect, it } from "vitest";
import { planAppliedAtDates, planStageChange, type HistoryStep } from "./stage-history";

// Stage order in the BUMN template.
const ORDER = { W: 0, ADM: 1, TPA: 2, PSI: 3, LGD: 4, HR: 5, MCU: 7, OFFER: 8, REJ: 9 } as const;
type S = keyof typeof ORDER;
const steps = (...ids: (S | `${S}*`)[]): HistoryStep[] =>
  ids.map((s, i) => {
    const stageId = s.replace("*", "") as S;
    return { id: `h${i}`, stageId, order: ORDER[stageId], kept: s.endsWith("*") };
  });
const to = (s: S) => ({ id: s, order: ORDER[s] });
// The history that results from a plan, as stage ids.
const after = (h: HistoryStep[], target: S) => {
  const { drop, append } = planStageChange(h, to(target));
  return [...h.filter((s) => !drop.includes(s.id)).map((s) => s.stageId), ...(append ? [target] : [])];
};

describe("planStageChange", () => {
  it("appends when moving forward", () => {
    expect(after(steps("W", "ADM"), "PSI")).toEqual(["W", "ADM", "PSI"]);
  });

  it("drops a mis-drop when the card is corrected to an earlier, never-visited stage", () => {
    expect(after(steps("W", "MCU"), "ADM")).toEqual(["W", "ADM"]);
  });

  it("returns to a visited stage without repeating it", () => {
    expect(after(steps("W", "ADM", "TPA", "PSI"), "ADM")).toEqual(["W", "ADM"]);
  });

  it("keeps wild dragging in stage order", () => {
    let h = steps("W");
    for (const s of ["PSI", "HR", "ADM", "OFFER", "TPA", "LGD"] as S[]) {
      const ids = after(h, s);
      h = ids.map((stageId, i) => ({ id: `x${i}-${stageId}`, stageId, order: ORDER[stageId as S], kept: false }));
    }
    expect(h.map((s) => s.stageId)).toEqual(["W", "ADM", "TPA", "LGD"]);
  });

  it("never drops a step with notes or a result", () => {
    expect(after(steps("W", "ADM", "TPA*"), "ADM")).toEqual(["W", "ADM", "TPA", "ADM"]);
    expect(after(steps("W", "ADM*", "MCU"), "TPA")).toEqual(["W", "ADM", "TPA"]);
  });

  it("reopening a rejected application drops the rejection", () => {
    expect(after(steps("W", "ADM", "REJ"), "TPA")).toEqual(["W", "ADM", "TPA"]);
  });

  it("undoing a move restores the previous history", () => {
    expect(after(steps("W", "ADM", "PSI"), "ADM")).toEqual(["W", "ADM"]);
    expect(after(steps("W"), "ADM")).toEqual(["W", "ADM"]);
  });
});

describe("planAppliedAtDates", () => {
  const day = (d: number) => new Date(Date.UTC(2026, 8, d));
  const h = (id: string, kind: "WISHLIST" | "IN_PROGRESS" | "REJECTED", d: number) => ({ id, kind, enteredAt: day(d) });

  it("dates the applying step, and a Wishlist step just before it", () => {
    expect(planAppliedAtDates([h("w", "WISHLIST", 19), h("adm", "IN_PROGRESS", 19)], day(18))).toEqual([
      { id: "w", enteredAt: new Date(day(18).getTime() - 1) },
      { id: "adm", enteredAt: day(18) },
    ]);
  });

  it("a card that never had Wishlist only dates its first step", () => {
    expect(planAppliedAtDates([h("adm", "IN_PROGRESS", 19)], day(1))).toEqual([{ id: "adm", enteredAt: day(1) }]);
  });

  it("leaves later steps alone, and does nothing without a date, without an applying step, or out of order", () => {
    expect(
      planAppliedAtDates([h("w", "WISHLIST", 19), h("adm", "IN_PROGRESS", 19), h("t", "IN_PROGRESS", 20)], day(18)).map(
        (x) => x.id,
      ),
    ).toEqual(["w", "adm"]);
    expect(planAppliedAtDates([h("w", "WISHLIST", 19), h("adm", "IN_PROGRESS", 19)], null)).toEqual([]);
    expect(planAppliedAtDates([h("w", "WISHLIST", 19)], day(18))).toEqual([]);
    expect(
      planAppliedAtDates([h("w", "WISHLIST", 1), h("adm", "IN_PROGRESS", 2), h("t", "IN_PROGRESS", 3)], day(10)),
    ).toEqual([]);
  });
});
