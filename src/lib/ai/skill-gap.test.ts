import { describe, expect, it } from "vitest";
import { matchSkills, verifySkillGap } from "./skill-gap";

const cv = "KEAHLIAN\nTypeScript, React.js, Postgres\nPENGALAMAN\nMembuat laporan pivot di spreadsheet";

describe("matchSkills", () => {
  it("finds aliases without AI and leaves the rest for the LLM", () => {
    const { found, missing } = matchSkills(["React", "PostgreSQL", "Pivot Table", "Docker", "React"], cv);
    expect(found.map((f) => f.skill)).toEqual(["React", "PostgreSQL"]);
    expect(found[0].sourceQuote).toBe("TypeScript, React.js, Postgres");
    expect(missing).toEqual(["Pivot Table", "Docker"]); // duplicates collapsed
  });
});

describe("verifySkillGap", () => {
  const redacted = "KEAHLIAN\nTypeScript, React.js, Postgres\nPENGALAMAN\nMembuat laporan pivot di spreadsheet";
  it("keeps found skills only when the quote is really in the redacted CV", () => {
    const rows = verifySkillGap(
      ["Pivot Table", "Docker", "Kubernetes"],
      {
        results: [
          { skill: "pivot table", inResume: true, suggestion: "Sebutkan contoh laporannya.", quote: "laporan pivot di  spreadsheet" },
          { skill: "Docker", inResume: true, suggestion: "Tambahkan proyek.", quote: "Docker compose untuk 5 layanan" }, // invented
        ],
      },
      redacted,
    );
    expect(rows).toEqual([
      { skill: "Pivot Table", inResume: true, suggestion: "Sebutkan contoh laporannya.", sourceQuote: "laporan pivot di  spreadsheet" },
      { skill: "Docker", inResume: false, suggestion: "Tambahkan proyek.", sourceQuote: null },
      { skill: "Kubernetes", inResume: false, suggestion: null, sourceQuote: null }, // no answer from the model
    ]);
  });
});
