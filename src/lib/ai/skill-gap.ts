import { z } from "zod";
import { findSkillInText } from "@/lib/ai/skill-aliases";

export type GapRow = { skill: string; inResume: boolean; suggestion: string | null; sourceQuote: string | null };

/** Step 1 (no AI): skills the CV mentions verbatim or via an alias are marked found right away. */
export function matchSkills(skills: string[], cvText: string) {
  const found: GapRow[] = [];
  const missing: string[] = [];
  for (const skill of [...new Set(skills)]) {
    const line = findSkillInText(skill, cvText);
    if (line) found.push({ skill, inResume: true, suggestion: null, sourceQuote: line });
    else missing.push(skill);
  }
  return { found, missing };
}

export const SkillGapAnswer = z.object({
  results: z.array(
    z.object({
      skill: z.string(),
      inResume: z.boolean(),
      suggestion: z.string().nullable(),
      quote: z.string().nullable(), // exact snippet of the redacted CV
    }),
  ),
});
export type SkillGapAnswer = z.infer<typeof SkillGapAnswer>;

export const SKILL_GAP_SYSTEM = `Kamu membantu pencari kerja di Indonesia membandingkan CV dengan skill yang diminta lowongan.
Teks CV sudah disamarkan (nama, kontak, dan alamat diganti tanda seperti [nama]).

Untuk SETIAP skill di daftar:
- inResume: true hanya jika CV jelas menunjukkan skill itu, termasuk lewat istilah setara (contoh: "analisis data dengan pivot" untuk "Pivot Table"). Kalau ragu, false.
- quote: potongan teks yang disalin persis dari CV sebagai bukti. null kalau inResume false.
- suggestion: satu kalimat singkat berbahasa Indonesia. Kalau belum ada, saran konkret cara mempelajari atau membuktikannya (proyek kecil, sertifikasi). Kalau sudah ada, saran cara menonjolkannya di CV.
Jangan menambah skill di luar daftar.`;

export function skillGapPrompt(missing: string[], redactedCv: string) {
  return `Skill yang dicek:\n${missing.map((s) => `- ${s}`).join("\n")}\n\nCV:\n${redactedCv}`;
}

const squash = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Step 3 checks on the LLM answer: one row per requested skill (missing answers → not found), and
 * "found" without a quote that really appears in the redacted CV is downgraded to not found.
 */
export function verifySkillGap(missing: string[], answer: SkillGapAnswer, redactedCv: string): GapRow[] {
  const cv = squash(redactedCv);
  return missing.map((skill) => {
    const r = answer.results.find((x) => squash(x.skill) === squash(skill));
    if (!r) return { skill, inResume: false, suggestion: null, sourceQuote: null };
    const quoteOk = !!r.quote && squash(r.quote).length > 0 && cv.includes(squash(r.quote));
    const inResume = r.inResume && quoteOk;
    return { skill, inResume, suggestion: r.suggestion, sourceQuote: inResume ? r.quote : null };
  });
}
