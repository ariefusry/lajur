import { describe, expect, it } from "vitest";
import { planStageChange, type HistoryStep } from "./stage-history";

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
