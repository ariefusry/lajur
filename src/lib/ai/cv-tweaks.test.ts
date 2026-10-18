import { describe, expect, it } from "vitest";
import { readCvTweaks, verifyCvTweaks, type CvTweak } from "./cv-tweaks";

const CV = "KEAHLIAN\nMicrosoft Excel, analisis data\nPENGALAMAN\nMagang Administrasi Keuangan (2025): menyusun laporan harian dengan Excel untuk tim [NAME_1]";
const rewrite = (current: string, suggestion: string): CvTweak => ({ kind: "rewrite", section: "Pengalaman", current, suggestion, reason: "r" });
const add = (suggestion: string): CvTweak => ({ kind: "add", section: "Proyek", current: null, suggestion, reason: "r" });

describe("verifyCvTweaks", () => {
  it("keeps honest rewrites and additions", () => {
    const out = verifyCvTweaks(
      [
        rewrite("menyusun laporan  harian\ndengan Excel", "Menyusun laporan keuangan harian dengan Microsoft Excel (2025)."),
        add("Kalau kamu pernah membuat proyek dengan React, tambahkan di bagian Proyek."),
      ],
      CV,
      {},
      ["React"],
    );
    expect(out.map((t) => t.kind)).toEqual(["rewrite", "add"]);
  });

  it("drops rewrites of text that isn't in the CV", () => {
    expect(verifyCvTweaks([rewrite("Memimpin tim 20 orang", "Memimpin tim.")], CV, {})).toEqual([]);
  });

  it("drops anything that makes up a number (year, GPA, amount, count)", () => {
    const made = [
      rewrite("menyusun laporan harian dengan Excel", "Menyusun 120 laporan harian dengan Excel."),
      add("Tambahkan Sertifikat React Fundamentals – Coursera (2024)."),
      add("Cantumkan IPK 3.20 di bagian Pendidikan."),
    ];
    expect(verifyCvTweaks(made, CV, {})).toEqual([]);
  });

  it("drops a rewrite that claims a posting skill the CV doesn't show, but allows it in an addition", () => {
    const out = verifyCvTweaks(
      [
        rewrite("menyusun laporan harian dengan Excel", "Membuat dashboard laporan dengan React dan Excel."),
        add("Kalau sudah belajar React, tambahkan di Keahlian."),
      ],
      CV,
      {},
      ["React"],
    );
    expect(out.map((t) => t.kind)).toEqual(["add"]);
  });

  it("drops an addition that hands over a made-up CV sentence in quotes", () => {
    const sample = add('Tulis ringkasan, misalnya: "Frontend developer dengan pengalaman membangun aplikasi React."');
    const short = add('Tambahkan bagian "Proyek" di bawah Pengalaman.');
    expect(verifyCvTweaks([sample, short], CV, {})).toEqual([short]);
  });

  it("caps at 8 and puts personal data back", () => {
    const many = Array(12).fill(add("Tambahkan ringkasan singkat di atas CV."));
    expect(verifyCvTweaks(many, CV, {})).toHaveLength(8);
    const [t] = verifyCvTweaks([rewrite("untuk tim [NAME_1]", "Untuk tim [NAME_1] di divisi keuangan.")], CV, { "[NAME_1]": "Rina" });
    expect(t).toMatchObject({ current: "untuk tim Rina", suggestion: "Untuk tim Rina di divisi keuangan." });
  });
});

describe("readCvTweaks", () => {
  it("returns saved tweaks, or [] for null/malformed JSON", () => {
    expect(readCvTweaks([add("x")])).toHaveLength(1);
    expect(readCvTweaks(null)).toEqual([]);
    expect(readCvTweaks([{ section: 1 }])).toEqual([]);
  });
});
