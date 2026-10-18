import { describe, expect, it } from "vitest";
import { ageOn, checkRequirement, numberForDegree, overallStatus, parseMinDegree, type EligibilityProfile } from "./check";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`); // @db.Date style
const wib = (iso: string) => new Date(`${iso}T00:00:00+07:00`);
const today = wib("2026-10-18");
const profile: EligibilityProfile = { gpa: 3.45, birthDate: d("2001-05-14"), major: "Informatika", degree: "S1" };
const empty: EligibilityProfile = { gpa: null, birthDate: null, major: null, degree: null };
const check = (type: Parameters<typeof checkRequirement>[0]["type"], value: string, p = profile, ageReferenceDate: Date | null = null) =>
  checkRequirement({ type, value, ageReferenceDate }, p, today).status;

describe("MIN_GPA", () => {
  it("meets when ≥, including exactly equal", () => {
    expect(check("MIN_GPA", "3.00")).toBe("MEETS");
    expect(check("MIN_GPA", "3.45")).toBe("MEETS");
    expect(check("MIN_GPA", "IPK minimal 3,25")).toBe("MEETS");
  });
  it("fails when below", () => expect(check("MIN_GPA", "3.50")).toBe("FAILS"));
  it("unknown when profile empty or value unreadable", () => {
    expect(check("MIN_GPA", "3.00", empty)).toBe("UNKNOWN");
    expect(check("MIN_GPA", "minimal memuaskan")).toBe("UNKNOWN");
  });
});

describe("MAX_AGE", () => {
  it("age exactly at the limit still meets", () => {
    // Born 2001-05-14 → 25 on 2026-10-18.
    expect(check("MAX_AGE", "25")).toBe("MEETS");
    expect(check("MAX_AGE", "24")).toBe("FAILS");
  });
  it("uses ageReferenceDate when given", () => {
    // 2027-06-30: already 26.
    expect(check("MAX_AGE", "25 tahun", profile, d("2027-06-30"))).toBe("FAILS");
    // Day before the 26th birthday: still 25.
    expect(check("MAX_AGE", "25", profile, d("2027-05-13"))).toBe("MEETS");
    expect(check("MAX_AGE", "25", profile, d("2027-05-14"))).toBe("FAILS");
  });
  it("unknown without birth date", () => expect(check("MAX_AGE", "25", empty)).toBe("UNKNOWN"));
  it("29 February birthdays", () => {
    const leap = d("2000-02-29");
    expect(ageOn(leap, wib("2025-02-28"))).toBe(24); // non-leap year: not yet
    expect(ageOn(leap, wib("2025-03-01"))).toBe(25);
    expect(ageOn(leap, wib("2024-02-29"))).toBe(24); // leap year: on the day
    expect(ageOn(leap, wib("2024-02-28"))).toBe(23);
    const p = { ...profile, birthDate: leap };
    expect(check("MAX_AGE", "25", p, d("2026-02-28"))).toBe("MEETS"); // still 25
    expect(check("MAX_AGE", "25", p, d("2026-03-01"))).toBe("FAILS"); // turns 26
  });
});

describe("MAJOR", () => {
  it("matches synonyms case-insensitively", () => {
    expect(check("MAJOR", "S1 Teknik Informatika/Sistem Informasi")).toBe("MEETS");
    expect(check("MAJOR", "Computer Science")).toBe("MEETS");
    expect(check("MAJOR", "ILMU KOMPUTER")).toBe("MEETS");
    expect(check("MAJOR", "Teknik Informatika", { ...profile, major: "Ilmu Komputer" })).toBe("MEETS");
  });
  it("'semua jurusan' always meets", () => {
    expect(check("MAJOR", "Semua jurusan")).toBe("MEETS");
    expect(check("MAJOR", "semua jurusan", empty)).toBe("MEETS");
  });
  it("mismatch is a warning, not a failure", () => {
    expect(check("MAJOR", "Akuntansi, Manajemen")).toBe("WARNING");
    expect(check("MAJOR", "Sistem Informasi")).toBe("WARNING");
  });
  it("unknown without profile major", () => expect(check("MAJOR", "Informatika", empty)).toBe("UNKNOWN"));
});

describe("MIN_DEGREE", () => {
  it("orders SMA < D1 < D2 < D3 < D4 = S1 < S2 < S3", () => {
    expect(check("MIN_DEGREE", "S1")).toBe("MEETS");
    expect(check("MIN_DEGREE", "D4")).toBe("MEETS"); // S1 ≥ D4
    expect(check("MIN_DEGREE", "Minimal S1", { ...profile, degree: "D4" })).toBe("MEETS"); // D4 = S1
    expect(check("MIN_DEGREE", "S2")).toBe("FAILS");
    expect(check("MIN_DEGREE", "S1", { ...profile, degree: "D3" })).toBe("FAILS");
    expect(check("MIN_DEGREE", "SMA/SMK sederajat", { ...profile, degree: "SMA" })).toBe("MEETS");
  });
  it("handles diplomas below D3 and doctorates", () => {
    expect(parseMinDegree("Minimal D1")).toBe("D1");
    expect(parseMinDegree("Diploma II")).toBe("D2");
    expect(parseMinDegree("D2/D3")).toBe("D2");
    expect(parseMinDegree("S3 / Doktor")).toBe("S3");
    expect(parseMinDegree("Berpengalaman di bidang perbankan")).toBeNull(); // "di" is a preposition, not D1
    expect(check("MIN_DEGREE", "D3", { ...profile, degree: "D2" })).toBe("FAILS");
    expect(check("MIN_DEGREE", "D1", { ...profile, degree: "D2" })).toBe("MEETS");
    expect(check("MIN_DEGREE", "S2", { ...profile, degree: "S3" })).toBe("MEETS");
    expect(check("MIN_DEGREE", "S3")).toBe("FAILS"); // profile is S1
  });
  it("takes the lowest of listed degrees", () => {
    expect(parseMinDegree("D3/S1")).toBe("D3");
    expect(parseMinDegree("Sarjana Terapan")).toBe("D4");
    expect(parseMinDegree("Magister")).toBe("S2");
    expect(check("MIN_DEGREE", "D3 atau S1", { ...profile, degree: "D3" })).toBe("MEETS");
  });
  it("unknown when unreadable or profile empty", () => {
    expect(check("MIN_DEGREE", "lulusan perguruan tinggi")).toBe("UNKNOWN");
    expect(check("MIN_DEGREE", "S1", empty)).toBe("UNKNOWN");
  });
});

describe("other types", () => {
  it("placement and service bond are always warnings", () => {
    expect(check("PLACEMENT", "Seluruh Indonesia")).toBe("WARNING");
    expect(check("SERVICE_BOND", "2 tahun", empty)).toBe("WARNING");
    expect(checkRequirement({ type: "PLACEMENT", value: "x", ageReferenceDate: null }, profile, today).reason).toMatch(
      /perlu dipertimbangkan/i,
    );
  });
  it("OTHER is unknown", () => expect(check("OTHER", "Bersedia lembur")).toBe("UNKNOWN"));
});

describe("overallStatus", () => {
  it("worst wins", () => {
    expect(overallStatus(["MEETS", "WARNING", "FAILS"])).toBe("FAILS");
    expect(overallStatus(["MEETS", "UNKNOWN", "WARNING"])).toBe("WARNING");
    expect(overallStatus(["MEETS", "UNKNOWN"])).toBe("UNKNOWN");
    expect(overallStatus(["MEETS"])).toBe("MEETS");
    expect(overallStatus([])).toBeNull();
  });
});

describe("per-degree variants", () => {
  it("picks the number for the profile's degree", () => {
    expect(numberForDegree("3.00 (S1), 3.25 (S2)", "S1")).toBe(3);
    expect(numberForDegree("3.00 (S1), 3.25 (S2)", "S2")).toBe(3.25);
    expect(numberForDegree("IPK minimal 3,00 untuk S1 dan 3,25 untuk S2", "S2")).toBe(3.25);
    expect(numberForDegree("26 tahun untuk S1 dan 28 tahun untuk S2", "S2")).toBe(28);
    expect(numberForDegree("3.00 (S1), 3.25 (S2)", "D3")).toBe(3); // no variant for D3 → first number
    expect(numberForDegree("3.00", null)).toBe(3);
  });
  it("an S1 graduate is not failed by the S2 variant", () => {
    const s1 = { ...profile, gpa: 3.1, degree: "S1" as const };
    expect(check("MIN_GPA", "3.00 (S1), 3.25 (S2)", s1)).toBe("MEETS");
    expect(check("MIN_GPA", "3.00 (S1), 3.25 (S2)", { ...s1, degree: "S2" })).toBe("FAILS");
    expect(check("MAX_AGE", "26 (S1), 28 (S2)", { ...profile, birthDate: d("1999-01-01"), degree: "S2" })).toBe("MEETS"); // 27
    expect(check("MAX_AGE", "26 (S1), 28 (S2)", { ...profile, birthDate: d("1999-01-01") })).toBe("FAILS");
  });
});

describe("non-IT majors", () => {
  const p = (major: string) => ({ ...profile, major });
  it("matches synonyms across fields", () => {
    expect(check("MAJOR", "S1 Accounting", p("Akuntansi"))).toBe("MEETS");
    expect(check("MAJOR", "Teknik Sipil / Arsitektur", p("Civil Engineering"))).toBe("MEETS");
    expect(check("MAJOR", "Ilmu Hukum", p("Hukum"))).toBe("MEETS");
    expect(check("MAJOR", "Keperawatan, Kesehatan Masyarakat", p("Nursing"))).toBe("MEETS");
    expect(check("MAJOR", "Psikologi", p("Akuntansi"))).toBe("WARNING");
  });
  it("picks the most specific synonym group", () => {
    expect(check("MAJOR", "Jurusan Logistik Kelautan, Manajemen Transportasi Laut, Logistik", p("Manajemen Logistik"))).toBe("MEETS");
    expect(check("MAJOR", "Manajemen", p("Manajemen Logistik"))).toBe("WARNING");
  });
});
