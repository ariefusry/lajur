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
  it("caps length at 20k chars", () => {
    expect(normalizeJobText("a".repeat(25_000))).toHaveLength(20_000);
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
    quotes: { company: null, position: null, location: null, deadline: null },
    skills: [], requirements: [],
  };
  it("flags an answer with nothing in it", () => expect(isEmptyExtraction(empty)).toBe(true));
  it("anything found counts as non-empty", () => {
    expect(isEmptyExtraction({ ...empty, position: "Magang" })).toBe(false);
    expect(isEmptyExtraction({ ...empty, skills: [{ name: "SQL", quote: "SQL" }] })).toBe(false);
  });
});
