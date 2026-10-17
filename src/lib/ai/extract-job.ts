import { createHash } from "node:crypto";
import { z } from "zod";

export const MAX_JOB_TEXT = 20_000;

export const ExtractedJob = z.object({
  company: z.string().nullable(),
  position: z.string().nullable(),
  location: z.string().nullable(),
  deadline: z.iso.date().nullable(), // YYYY-MM-DD
  // Evidence for the scalar fields above, so the form can show where each value came from.
  quotes: z.object({
    company: z.string().nullable(),
    position: z.string().nullable(),
    location: z.string().nullable(),
    deadline: z.string().nullable(),
  }),
  skills: z.array(z.object({ name: z.string(), quote: z.string() })),
  requirements: z.array(
    z.object({
      type: z.enum(["MIN_GPA", "MAX_AGE", "MAJOR", "MIN_DEGREE", "PLACEMENT", "SERVICE_BOND", "OTHER"]),
      value: z.string(),
      ageReferenceDate: z.iso.date().nullable(), // "per 31 Desember 2026"
      quote: z.string(), // exact substring of the posting
    }),
  ),
});
export type ExtractedJob = z.infer<typeof ExtractedJob>;

export const EXTRACT_SYSTEM = `Kamu mengekstrak data terstruktur dari teks lowongan kerja berbahasa Indonesia atau Inggris.

Aturan:
- Hanya ambil informasi yang TERTULIS di teks. Kalau tidak ada, isi null atau array kosong. Dilarang menebak.
- Setiap "quote" WAJIB berupa potongan teks yang disalin persis karakter demi karakter dari lowongan (boleh pendek, cukup frasa yang memuat buktinya). Jangan parafrase, jangan terjemahkan.
- deadline dan ageReferenceDate dalam format YYYY-MM-DD. Kalau tahun tidak disebut, isi null.
- location: kota/wilayah penempatan atau kantor.
- skills: keahlian teknis, tools, bahasa, sertifikasi, atau lisensi yang diminta, dari bidang apa pun (contoh: Microsoft Excel, SAP, Accurate, perpajakan, AutoCAD, Canva, SQL, bahasa Inggris, Brevet A&B, SIM A). Bukan soft skill umum seperti "jujur" atau "mampu bekerja dalam tim".
- requirements: SATU item per jenis syarat (jangan ada dua MIN_GPA, dua MAX_AGE, atau dua MIN_DEGREE).
  Kalau syarat dibedakan per jenjang, gabungkan semua varian dalam satu value, contoh "IPK minimal 3,00 untuk S1 dan 3,25 untuk S2" menjadi MIN_GPA "3.00 (S1), 3.25 (S2)", dan "usia maksimal 26 tahun untuk S1 dan 28 tahun untuk S2" menjadi MAX_AGE "26 (S1), 28 (S2)". Jenjang "S1/S2" menjadi MIN_DEGREE "S1".
  - MIN_GPA: value angka IPK minimal, contoh "3.00" (atau varian per jenjang seperti di atas).
  - MAX_AGE: value angka usia maksimal, contoh "25" (atau varian per jenjang). Isi ageReferenceDate jika disebut ("per 31 Desember 2026").
  - MAJOR: value daftar jurusan persis seperti di teks, TANPA jenjang (contoh "Teknik Informatika/Sistem Informasi").
  - MIN_DEGREE: value jenjang minimal (SMA, D3, D4, S1, S2), ambil yang terendah kalau ada beberapa. Buat item terpisah dari MAJOR walau ditulis bersama, contoh "S1 Teknik Informatika" menghasilkan MIN_DEGREE "S1" dan MAJOR "Teknik Informatika", keduanya dengan quote yang sama.
  - PLACEMENT: penempatan, contoh "Seluruh Indonesia".
  - SERVICE_BOND: ikatan dinas, contoh "2 tahun".
  - OTHER: syarat administratif penting lain (contoh: belum menikah, tidak buta warna).`;

/** Trim + tidy whitespace; the normalized text is what gets hashed, sent, and quote-checked. */
export function normalizeJobText(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_JOB_TEXT);
}

/** Cache key. The prompt is part of it, so editing EXTRACT_SYSTEM invalidates old extractions automatically. */
export function hashJobText(normalized: string) {
  return createHash("sha256").update(EXTRACT_SYSTEM).update("\0").update(normalized).digest("hex");
}

// Quotes must be exact substrings; whitespace differences (line breaks vs spaces) are forgiven.
const squash = (s: string) => s.replace(/\s+/g, " ").trim();

/** Drops skills/requirements whose quote isn't in the posting; nulls unverifiable scalar quotes. */
export function verifyQuotes(job: ExtractedJob, text: string): ExtractedJob {
  const haystack = squash(text);
  const found = (q: string | null) => !!q && squash(q).length > 0 && haystack.includes(squash(q));
  return {
    ...job,
    quotes: {
      company: found(job.quotes.company) ? job.quotes.company : null,
      position: found(job.quotes.position) ? job.quotes.position : null,
      location: found(job.quotes.location) ? job.quotes.location : null,
      deadline: found(job.quotes.deadline) ? job.quotes.deadline : null,
    },
    skills: job.skills.filter((s) => found(s.quote)),
    requirements: job.requirements.filter((r) => found(r.quote)),
  };
}

/** True when the model found nothing usable (e.g. a JS-only page or a login wall was fetched instead of the ad). */
export function isEmptyExtraction(job: ExtractedJob) {
  return !job.company && !job.position && !job.location && !job.deadline && !job.skills.length && !job.requirements.length;
}
