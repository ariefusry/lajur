import { describe, expect, it } from "vitest";
import { ExtractedJob, hashJobText, isEmptyExtraction, normalizeJobText, verifyQuotes } from "./extract-job";
import { JOB_FIXTURES } from "./job-fixtures";

const [bumn] = JOB_FIXTURES;

// What a good model answer for the BUMN fixture looks like, plus planted hallucinations.
const modelAnswer: ExtractedJob = {
  company: "PT Telkom Indonesia (Persero) Tbk",
  position: "Associate Software Engineer",
  location: "Bandung, Jawa Barat",
  deadline: "2026-11-10",
  employmentType: null,
  workMode: null,
  salaryRange: "Rp15 juta", // hallucinated
  sourceUrl: null,
  language: "id",
  quotes: {
    company: "PT Telkom Indonesia (Persero) Tbk",
    position: "Posisi: Associate Software Engineer",
    location: "Lokasi Kerja: Bandung, Jawa Barat",
    deadline: "ditutup 10 November 2026",
  },
  skills: [
    { name: "Java", quote: "Menguasai Java atau Go" },
    { name: "Kubernetes", quote: "Menguasai Kubernetes" }, // hallucinated
  ],
  requirements: [
    { type: "MIN_GPA", value: "3.00", ageReferenceDate: null, quote: "IPK minimal 3.00 (skala 4.00)" },
    { type: "MAX_AGE", value: "25", ageReferenceDate: "2026-12-01", quote: "Usia maksimal 25 tahun per 1 Desember 2026" },
    { type: "OTHER", value: "Tidak buta warna", ageReferenceDate: null, quote: "Tidak buta warna" }, // hallucinated
  ],
};

describe("normalizeJobText", () => {
  it("tidies whitespace and is stable for hashing", () => {
    const messy = "  PT A \r\n\r\n\r\n\tPosisi:  IT   Staff \n";
    expect(normalizeJobText(messy)).toBe("PT A\n\nPosisi: IT Staff");
    expect(hashJobText(normalizeJobText(messy))).toBe(hashJobText(normalizeJobText("PT A\n\nPosisi: IT Staff")));
  });
  it("caps length at 12k chars (Groq free tier: 8K tokens/minute)", () => {
    expect(normalizeJobText("a".repeat(25_000))).toHaveLength(12_000);
  });
});

describe("verifyQuotes", () => {
  const text = normalizeJobText(bumn.text);
  const verified = verifyQuotes(modelAnswer, text);

  it("drops skills and requirements whose quote is not in the posting", () => {
    expect(verified.skills.map((s) => s.name)).toEqual(["Java"]);
    expect(verified.requirements.map((r) => r.type)).toEqual(["MIN_GPA", "MAX_AGE"]);
  });
  it("keeps valid scalar quotes, nulls invented ones", () => {
    expect(verified.quotes.company).toBe("PT Telkom Indonesia (Persero) Tbk");
    const bad = verifyQuotes({ ...modelAnswer, quotes: { ...modelAnswer.quotes, location: "Jakarta" } }, text);
    expect(bad.quotes.location).toBeNull();
    expect(bad.location).toBe("Bandung, Jawa Barat"); // value stays as a draft; UI shows it without evidence
  });
  it("nulls a salary or link that isn't written in the posting", () => {
    expect(verified.salaryRange).toBeNull();
    const posting = "Gaji Rp8–10 juta. Daftar di https://karier.contoh.co.id/it";
    const r = verifyQuotes({ ...modelAnswer, salaryRange: "Rp8–10 juta", sourceUrl: "https://karier.contoh.co.id/it" }, posting);
    expect(r).toMatchObject({ salaryRange: "Rp8–10 juta", sourceUrl: "https://karier.contoh.co.id/it" });
  });
  it("forgives line-break vs space differences inside a quote", () => {
    const r = verifyQuotes(
      { ...modelAnswer, skills: [{ name: "REST", quote: "Memahami REST API dan\nPostgreSQL" }] },
      text,
    );
    expect(r.skills).toHaveLength(1);
  });
  it("rejects empty quotes", () => {
    const r = verifyQuotes({ ...modelAnswer, skills: [{ name: "X", quote: "  " }] }, text);
    expect(r.skills).toHaveLength(0);
  });
  it("keeps a skill with a paraphrased quote when the skill itself is in the posting, citing its line", () => {
    const posting = "Kualifikasi:\n- Menguasai React, TypeScript, dan Tailwind CSS\n- Paham REST API dan Git";
    const r = verifyQuotes(
      { ...modelAnswer, skills: [{ name: "TypeScript", quote: "Menguasai TypeScript" }, { name: "Git", quote: "Paham Git" }, { name: "Docker", quote: "Paham Docker" }] },
      posting,
    );
    expect(r.skills).toEqual([
      { name: "TypeScript", quote: "- Menguasai React, TypeScript, dan Tailwind CSS" },
      { name: "Git", quote: "- Paham REST API dan Git" },
    ]);
  });
});

describe("ExtractedJob schema", () => {
  it("accepts the sample answer and rejects bad dates", () => {
    expect(ExtractedJob.safeParse(modelAnswer).success).toBe(true);
    expect(ExtractedJob.safeParse({ ...modelAnswer, deadline: "10 November 2026" }).success).toBe(false);
  });
});

describe("isEmptyExtraction", () => {
  const empty: ExtractedJob = {
    company: null, position: null, location: null, deadline: null,
    employmentType: null, workMode: null, salaryRange: null, sourceUrl: null, language: "id",
    quotes: { company: null, position: null, location: null, deadline: null },
    skills: [], requirements: [],
  };
  it("flags an answer with nothing in it", () => expect(isEmptyExtraction(empty)).toBe(true));
  it("anything found counts as non-empty", () => {
    expect(isEmptyExtraction({ ...empty, position: "Magang" })).toBe(false);
    expect(isEmptyExtraction({ ...empty, skills: [{ name: "SQL", quote: "SQL" }] })).toBe(false);
  });
});
