import "server-only";
import { z } from "zod";
import { AiConsentRequiredError } from "@/lib/ai/consent";
import { CvTweak, MAX_CV_TWEAKS, verifyCvTweaks } from "@/lib/ai/cv-tweaks";
import type { ExtractedJob } from "@/lib/ai/extract-job";
import { aiEnabled, AiUnavailableError, generateStructured } from "@/lib/ai/provider";
import { redact, rehydrate, type KnownPii } from "@/lib/ai/redact";
import { matchSkills, SkillGapAnswer, verifySkillGap, type GapRow } from "@/lib/ai/skill-gap";
import { QuotaExceededError } from "@/lib/ai/usage";

export const CvCheckAnswer = z.object({
  skills: SkillGapAnswer.shape.results,
  tweaks: z.array(CvTweak),
});

export const CV_CHECK_SYSTEM = `Kamu membantu pencari kerja di Indonesia mencocokkan CV dengan satu lowongan.
Teks CV sudah disamarkan (nama, kontak, dan alamat diganti tanda seperti [NAME_1] atau [EMAIL_1]). Biarkan tanda itu apa adanya.

skills: satu item untuk SETIAP skill di "Skill yang dicek" (kosongkan kalau daftarnya kosong, jangan menambah skill lain):
- inResume: true hanya jika CV jelas menunjukkan skill itu, termasuk lewat istilah setara (contoh: "analisis data dengan pivot" untuk "Pivot Table"). Kalau ragu, false.
- quote: potongan teks yang disalin persis dari CV sebagai bukti. null kalau inResume false.
- suggestion: satu kalimat singkat berbahasa Indonesia. Kalau belum ada, saran konkret cara mempelajari atau membuktikannya (proyek kecil, sertifikasi). Kalau sudah ada, saran cara menonjolkannya di CV.

tweaks: paling banyak ${MAX_CV_TWEAKS} saran perbaikan CV yang paling berpengaruh untuk lowongan ini, urut dari yang terpenting. CV milik orang sungguhan: saran yang mengarang membuat CV-nya berisi klaim palsu. Ada dua jenis:
- kind "rewrite": menulis ulang bagian yang SUDAH ADA di CV supaya lebih relevan dengan lowongan (kata kerja aktif, urutan, istilah dari lowongan untuk hal yang memang sudah dikerjakan).
  current: potongan teks yang disalin persis dari CV. suggestion: versi baru yang siap ditempel, dalam bahasa CV.
  Versi baru HANYA boleh memakai fakta yang tertulis di CV. Dilarang menambah angka, tahun, tools, skill, sertifikat, perusahaan, atau pencapaian yang tidak ada di CV.
- kind "add": hal yang belum ada di CV dan layak dilengkapi KALAU user memang memilikinya. current: null.
  suggestion: instruksi singkat berbahasa Indonesia untuk user, contoh "Kalau kamu pernah membuat proyek dengan React, tambahkan di bagian Proyek beserta link-nya." Jangan menulis contoh isi CV, nama proyek, sertifikat, angka, atau tahun karangan.
- section: bagian CV yang dimaksud (contoh "Keahlian", "Pengalaman", "Proyek", "Ringkasan").
- reason: satu kalimat berbahasa Indonesia yang mengaitkan saran dengan syarat atau skill di lowongan.
Kalau CV memang kurang cocok dengan lowongan, katakan lewat saran "add"; jangan memaksakan "rewrite" yang mengklaim skill yang tidak dimiliki.`;

/** The extracted posting, not its full text: the CV already takes most of Groq's 8K tokens/minute. */
export function cvCheckPrompt(posting: ExtractedJob, missing: string[], redactedCv: string) {
  const lines = [
    posting.position && `Posisi: ${posting.position}`,
    posting.company && `Perusahaan: ${posting.company}`,
    posting.skills.length > 0 && `Skill yang diminta: ${posting.skills.map((s) => s.name).join(", ")}`,
    ...posting.requirements.map((r) => `Syarat (${r.type}): ${r.value}`),
  ].filter(Boolean);
  const toCheck = missing.length ? missing.map((s) => `- ${s}`).join("\n") : "(kosong: semua skill sudah ditemukan di CV)";
  return `Lowongan:\n${lines.join("\n")}\n\nSkill yang dicek:\n${toCheck}\n\nCV:\n${redactedCv}`;
}

export type CvCheckResult = {
  rows: GapRow[];
  tweaks: CvTweak[];
  matchedWithoutAi: number;
  checkedByAi: number;
  /** Why the AI part didn't run (quota, consent, unavailable); the string-match result is still returned. */
  aiNote: string | null;
};

/**
 * CV vs posting: skills the CV names (or an alias of) are found without AI; one AI call then
 * checks the rest for equivalent terms and writes up to 8 CV tweaks. Only the redacted CV leaves the server,
 * and the user's own data is put back into the answer afterwards.
 */
export async function checkCv({
  posting,
  cvText,
  owner,
  userId,
}: {
  posting: ExtractedJob;
  cvText: string;
  owner: KnownPii;
  userId: string;
}): Promise<CvCheckResult> {
  const { found, missing } = matchSkills(
    posting.skills.map((s) => s.name),
    cvText,
  );
  const notChecked = (suggestion: string): GapRow[] =>
    missing.map((skill) => ({ skill, inResume: false, suggestion, sourceQuote: null }));
  const withoutAi = (aiNote: string): CvCheckResult => ({
    rows: [...found, ...notChecked("Tidak ditemukan di CV. Istilah setara belum dicek AI.")],
    tweaks: [],
    matchedWithoutAi: found.length,
    checkedByAi: 0,
    aiNote,
  });
  if (!aiEnabled()) return withoutAi("AI tidak aktif, jadi hanya pencocokan teks yang dipakai.");

  const cv = redact(cvText, owner);
  try {
    const { object } = await generateStructured({
      schema: CvCheckAnswer,
      system: CV_CHECK_SYSTEM,
      prompt: cvCheckPrompt(posting, missing, cv.text),
      feature: "SKILL_GAP",
      userId,
    });
    // Quotes are checked against what the AI saw, then shown with the user's own data back in.
    const fromAi = verifySkillGap(missing, { results: object.skills }, cv.text).map((r) => ({
      ...r,
      suggestion: r.suggestion && rehydrate(r.suggestion, cv.map),
      sourceQuote: r.sourceQuote && rehydrate(r.sourceQuote, cv.map),
    }));
    const stillMissing = fromAi.filter((r) => !r.inResume).map((r) => r.skill);
    return {
      rows: [...found, ...fromAi],
      tweaks: verifyCvTweaks(object.tweaks, cv.text, cv.map, stillMissing),
      matchedWithoutAi: found.length,
      checkedByAi: fromAi.length,
      aiNote: null,
    };
  } catch (error) {
    if (error instanceof QuotaExceededError || error instanceof AiConsentRequiredError) return withoutAi(error.message);
    if (!(error instanceof AiUnavailableError)) console.error("cv check failed", error instanceof Error ? error.name : "unknown");
    return withoutAi("AI sedang tidak tersedia, jadi hanya pencocokan teks yang dipakai.");
  }
}
