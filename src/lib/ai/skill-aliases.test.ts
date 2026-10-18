import { describe, expect, it } from "vitest";
import { findSkillInText, skillAliases } from "./skill-aliases";

const cv = `KEAHLIAN
TypeScript, React.js, Postgres, Microsoft Excel, C#, Node.js
PENGALAMAN
Membangun REST API dengan Express; deploy ke Google Cloud`;

describe("non-IT skills", () => {
  it("match without the AI", () => {
    expect(findSkillInText("Sales", "Pengalaman penjualan retail 2 tahun")).toBe("Pengalaman penjualan retail 2 tahun");
    expect(findSkillInText("Payroll", "Mengelola penggajian 120 karyawan")).toContain("penggajian");
    expect(findSkillInText("Leadership", "Ketua panitia, kepemimpinan tim 15 orang")).toContain("kepemimpinan");
    expect(findSkillInText("Supply chain", "Staf logistik gudang")).toContain("logistik");
  });
});

describe("findSkillInText", () => {
  it("matches aliases in both directions, case-insensitively", () => {
    expect(findSkillInText("PostgreSQL", cv)).toContain("Postgres");
    expect(findSkillInText("React", cv)).toContain("React.js");
    expect(findSkillInText("excel", cv)).toContain("Microsoft Excel");
    expect(findSkillInText("TS", cv)).toContain("TypeScript");
    expect(findSkillInText("NodeJS", cv)).toContain("Node.js");
    expect(findSkillInText("GCP", cv)).toContain("Google Cloud");
    expect(findSkillInText("RESTful API", cv)).toContain("REST API");
  });
  it("handles symbols in skill names", () => {
    expect(findSkillInText("C#", cv)).not.toBeNull();
    expect(findSkillInText("C++", cv)).toBeNull();
  });
  it("does not match inside other words", () => {
    expect(findSkillInText("Java", "Menguasai JavaScript")).toBeNull();
    expect(findSkillInText("Go", "Deploy ke Google Cloud")).toBeNull();
    expect(findSkillInText("SQL", "Menguasai PostgreSQL")).toBeNull();
    expect(findSkillInText("Next.js", "Next steps: belajar")).not.toBeNull(); // known trade-off: "next" alias
  });
  it("returns the matching line", () => {
    expect(findSkillInText("Express", cv)).toBe("Membangun REST API dengan Express; deploy ke Google Cloud");
  });
  it("unknown skills match only themselves", () => {
    expect(skillAliases("Pivot Table")).toEqual(["pivot table"]);
    expect(findSkillInText("Pivot Table", "pivot table dan VLOOKUP")).not.toBeNull();
  });
});

describe("non-IT skills", () => {
  const cv = "KEAHLIAN\nMS Excel, MYOB, Brevet A&B, TOEFL 550, Corel Draw, Auto CAD\nPENGALAMAN\nStaf pembukuan dan pajak di KAP Contoh";
  it("matches office, finance, design, language and certification aliases", () => {
    expect(findSkillInText("Microsoft Excel", cv)).not.toBeNull();
    expect(findSkillInText("Accounting", cv)).toContain("pembukuan");
    expect(findSkillInText("Perpajakan", cv)).toContain("pajak");
    expect(findSkillInText("Bahasa Inggris", cv)).toContain("TOEFL");
    expect(findSkillInText("CorelDRAW", cv)).not.toBeNull();
    expect(findSkillInText("AutoCAD", cv)).not.toBeNull();
    expect(findSkillInText("Brevet B", cv)).not.toBeNull();
    expect(findSkillInText("SAP", cv)).toBeNull();
  });
});
