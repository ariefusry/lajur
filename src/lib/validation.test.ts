import { describe, expect, it } from "vitest";
import { toDateInput } from "./dates";
import { applicationSchema, profileSchema } from "./validation";

const base = { company: "PT Bank Mandiri", position: "ODP IT", source: "BUMN_PORTAL", currentStageId: "s1" };

describe("applicationSchema", () => {
  it("turns empty optional fields into null", () => {
    const r = applicationSchema.parse({ ...base, url: "", location: " ", deadline: "", expectedSalary: "", notes: "" });
    expect(r).toMatchObject({ url: null, location: null, deadline: null, expectedSalary: null, notes: null });
  });

  it("accepts missing optional keys", () => {
    expect(applicationSchema.parse(base).appliedAt).toBeNull();
  });

  it("parses rupiah with thousand separators and Jakarta dates", () => {
    const r = applicationSchema.parse({ ...base, expectedSalary: "8.000.000", deadline: "2026-10-20" });
    expect(r.expectedSalary).toBe(8_000_000);
    expect(r.deadline?.toISOString()).toBe("2026-10-19T17:00:00.000Z");
    expect(toDateInput(r.deadline)).toBe("2026-10-20");
  });

  it("rejects missing company, bad url, bad salary, unknown source", () => {
    const r = applicationSchema.safeParse({
      ...base,
      company: "",
      url: "javascript:alert(1)",
      expectedSalary: "8jt",
      source: "X",
    });
    expect(r.success).toBe(false);
    const fields = r.error!.issues.map((i) => i.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["company", "url", "expectedSalary", "source"]));
  });
});

describe("profileSchema", () => {
  it("accepts comma decimal GPA and rejects > 4", () => {
    expect(profileSchema.parse({ gpa: "3,45" }).gpa).toBe("3.45");
    expect(profileSchema.safeParse({ gpa: "4.5" }).success).toBe(false);
  });
});
