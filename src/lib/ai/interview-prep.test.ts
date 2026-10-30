import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ generateStructured: vi.fn() }));
vi.mock("@/lib/ai/provider", () => ({ generateStructured: mocks.generateStructured }));

import {
  interviewKindFor,
  readInterviewPrep,
  verifyInterviewPrep,
  type InterviewPrepAnswer,
  type InterviewQuestion,
} from "./interview-prep";
import { generateInterviewPrep, interviewPrepPrompt } from "./interview-prep.server";

const stage = (name: string, kind = "IN_PROGRESS") => ({ name, kind });

describe("interviewKindFor", () => {
  it("maps interview stages by name", () => {
    expect(interviewKindFor(stage("Interview HR"))).toBe("HR");
    expect(interviewKindFor(stage("Interview User"))).toBe("USER");
    expect(interviewKindFor(stage("Technical Interview"))).toBe("USER");
    expect(interviewKindFor(stage("LGD"))).toBe("LGD");
    expect(interviewKindFor(stage("Melamar", "WISHLIST"))).toBe("GENERAL");
  });
  it("offers nothing for tests, psychotests, MCU and closed stages", () => {
    for (const name of ["Psikotes", "Tes Online/TPA", "Technical Test", "MCU"])
      expect(interviewKindFor(stage(name))).toBeNull();
    expect(interviewKindFor(stage("Interview HR", "REJECTED"))).toBeNull();
    expect(interviewKindFor(stage("Ditolak", "WITHDRAWN"))).toBeNull();
  });
});

const POSTING = "Bank Contoh mencari Data Analyst. Menguasai SQL dan Excel. Bersedia ditempatkan di seluruh Indonesia.";
const CV = "PENGALAMAN\nMembuat laporan penjualan dengan SQL untuk [NAME_1] selama 2 tahun.";
const q = (over: Partial<InterviewQuestion> = {}): InterviewQuestion => ({
  category: "teknis",
  question: "Ceritakan pengalamanmu dengan SQL.",
  why: "Lowongan meminta SQL.",
  quote: "Menguasai SQL dan Excel",
  sampleAnswer: "Saya membuat laporan penjualan dengan SQL selama 2 tahun. [Sebutkan hasil yang bisa diukur].",
  answerPoints: ["Ceritakan proyek SQL terbesarmu."],
  cvQuote: "Membuat laporan penjualan dengan SQL",
  tip: "Sebutkan hasilnya.",
  ...over,
});
const answer = (questions: InterviewQuestion[], questionsToAsk: string[] = []): InterviewPrepAnswer => ({
  questions,
  questionsToAsk,
});
const input = { posting: POSTING, redactedCv: CV, known: "Bank Contoh\nData Analyst" };

describe("verifyInterviewPrep", () => {
  it("keeps quotes found in the text the model saw and nulls the rest", () => {
    const [out] = verifyInterviewPrep(
      answer([q({ quote: "Wajib punya sertifikat ISO", cvQuote: "Memimpin tim 20 orang" })]),
      input,
      {},
    ).questions;
    expect(out.quote).toBeNull();
    expect(out.cvQuote).toBeNull();
    const [kept] = verifyInterviewPrep(answer([q()]), input, {}).questions;
    expect(kept.quote).toBe("Menguasai SQL dan Excel");
    expect(kept.cvQuote).toBe("Membuat laporan penjualan dengan SQL");
  });

  it("drops answer points with a number that is in none of the inputs", () => {
    const [out] = verifyInterviewPrep(
      answer([
        q({ answerPoints: ["Ceritakan laporan yang kamu buat selama 2 tahun.", "Sebut peningkatan penjualan 40%."] }),
      ]),
      input,
      {},
    ).questions;
    expect(out.answerPoints).toEqual(["Ceritakan laporan yang kamu buat selama 2 tahun."]);
  });

  it("empties a sample answer that carries an invented number, keeps one that only uses numbers from the inputs", () => {
    const out = verifyInterviewPrep(
      answer([q(), q({ question: "Lain", sampleAnswer: "Saya menaikkan penjualan 40% di [nama perusahaan]." })]),
      input,
      {},
    ).questions;
    expect(out[0].sampleAnswer).toContain("2 tahun");
    expect(out[1].sampleAnswer).toBe("");
  });

  it("drops duplicate questions, caps the lists, and puts personal data back", () => {
    const many = Array.from({ length: 12 }, (_, i) => q({ question: `Pertanyaan ${i}` }));
    const out = verifyInterviewPrep(
      answer([q({ tip: "Ingat [NAME_1]." }), q(), ...many], ["a", "b", "c", "d"]),
      input,
      { "[NAME_1]": "Rina" },
    );
    expect(out.questions).toHaveLength(6);
    expect(out.questions[0].tip).toBe("Ingat Rina.");
    expect(new Set(out.questions.map((x) => x.question)).size).toBe(6);
    expect(out.questionsToAsk).toEqual(["a", "b", "c"]);
  });
});

describe("readInterviewPrep", () => {
  it("returns saved entries by stage and skips malformed ones", () => {
    const good = {
      stageName: "Interview HR",
      kind: "HR",
      generatedAt: "2026-10-30T00:00:00.000Z",
      usedPosting: true,
      usedCv: false,
      questions: [q()],
      questionsToAsk: [],
    };
    // Saved before sampleAnswer existed.
    const oldQuestion: Partial<InterviewQuestion> = q();
    delete oldQuestion.sampleAnswer;
    const old = { ...good, questions: [oldQuestion] };
    expect(Object.keys(readInterviewPrep({ s1: good, s2: { nope: 1 } }))).toEqual(["s1"]);
    expect(readInterviewPrep({ s1: old }).s1.questions[0].sampleAnswer).toBe("");
    expect(readInterviewPrep(null)).toEqual({});
    expect(readInterviewPrep([good])).toEqual({});
  });
});

describe("generateInterviewPrep", () => {
  beforeEach(() => mocks.generateStructured.mockReset());
  const base = {
    company: "Bank Contoh",
    position: "Data Analyst",
    postingText: POSTING,
    expectedSalary: 8_000_000,
    requirements: [{ type: "PLACEMENT" as const, value: "seluruh Indonesia" }],
    stageName: "Interview HR",
    kind: "HR" as const,
    cvText: "Rina Sari\nrina@mail.id\n\nPENGALAMAN\nMembuat laporan penjualan dengan SQL untuk tim Rina selama 2 tahun.",
    owner: { name: "Rina Sari" },
    userId: "u1",
  };

  it("sends no name or contact to the AI, uses the INTERVIEW_PREP feature, and rehydrates the answer", async () => {
    mocks.generateStructured.mockResolvedValueOnce({
      object: answer([q({ tip: "Ceritakan, [NAME_1]." })], ["Apa tantangan terbesar tim ini?"]),
    });
    const prep = await generateInterviewPrep(base);
    const call = mocks.generateStructured.mock.calls[0][0];
    expect(call.feature).toBe("INTERVIEW_PREP");
    expect(call.prompt).not.toMatch(/rina/i);
    expect(call.prompt).not.toContain("rina@mail.id");
    expect(call.prompt).toContain("Gaji yang diharapkan: Rp8.000.000");
    expect(call.prompt).toContain("Syarat (penempatan): seluruh Indonesia");
    expect(prep.questions[0].tip).toBe("Ceritakan, Rina.");
    expect(prep).toMatchObject({ stageName: "Interview HR", kind: "HR", usedPosting: true, usedCv: true });
  });

  it("works from company and position alone", () => {
    const prompt = interviewPrepPrompt({ ...base, postingText: null, cvText: null }, "", "");
    expect(prompt).toContain("(tidak ada teks lowongan)");
    expect(prompt).toContain("(tidak ada CV)");
  });
});
