import "server-only";
import { z } from "zod";
import type { ExtractedJob } from "@/lib/ai/extract-job";
import { generateStructured } from "@/lib/ai/provider";
import { redact, rehydrate, type KnownPii, type PiiMap } from "@/lib/ai/redact";
import { squash } from "@/lib/ai/skill-gap";

export const MAX_CV_TWEAKS = 8;

export const CvTweaksAnswer = z.object({
  tweaks: z.array(
    z.object({
      section: z.string(),
      current: z.string().nullable(), // exact snippet of the redacted CV; null when the tweak adds something new
      suggestion: z.string(),
      reason: z.string(),
    }),
  ),
});
export type CvTweak = z.infer<typeof CvTweaksAnswer>["tweaks"][number];

export const CV_TWEAKS_SYSTEM = `Kamu membantu pencari kerja menyesuaikan CV dengan satu lowongan.
Teks CV sudah disamarkan (nama, kontak, dan alamat diganti tanda seperti [NAME_1] atau [EMAIL_1]). Biarkan tanda itu apa adanya.

Beri paling banyak ${MAX_CV_TWEAKS} saran yang paling berpengaruh, masing-masing:
- section: bagian CV yang diubah (contoh "Keahlian", "Pengalaman").
- current: potongan teks yang disalin persis dari CV yang perlu diubah, atau null kalau sarannya menambah hal baru.
- suggestion: teks pengganti atau tambahan yang siap ditempel ke CV.
- reason: satu kalimat yang mengaitkan saran dengan syarat atau skill di lowongan.
Hanya pakai pengalaman yang memang ada di CV. Jangan mengarang pengalaman, angka, atau sertifikat.
Tulis dalam bahasa CV, kecuali lowongan meminta CV berbahasa lain.`;

/** The extracted posting, not its full text: the CV already takes most of Groq's 8K tokens/minute. */
export function cvTweaksPrompt(posting: ExtractedJob, redactedCv: string) {
  const lines = [
    posting.position && `Posisi: ${posting.position}`,
    posting.company && `Perusahaan: ${posting.company}`,
    posting.skills.length > 0 && `Skill: ${posting.skills.map((s) => s.name).join(", ")}`,
    ...posting.requirements.map((r) => `Syarat (${r.type}): ${r.value}`),
  ].filter(Boolean);
  return `Lowongan:\n${lines.join("\n")}\n\nCV:\n${redactedCv}`;
}

/** At most 8; a tweak that claims to change text the CV doesn't contain is dropped; personal data goes back in. */
export function verifyCvTweaks(answer: z.infer<typeof CvTweaksAnswer>, redactedCv: string, map: PiiMap): CvTweak[] {
  const cv = squash(redactedCv);
  return answer.tweaks
    .filter((t) => t.current === null || (squash(t.current).length > 0 && cv.includes(squash(t.current))))
    .slice(0, MAX_CV_TWEAKS)
    .map((t) => ({
      section: t.section,
      current: t.current && rehydrate(t.current, map),
      suggestion: rehydrate(t.suggestion, map),
      reason: rehydrate(t.reason, map),
    }));
}

/** CV tweaks for one posting. Only the redacted CV leaves the server. Throws like generateStructured. */
export async function suggestCvTweaks({
  cvText,
  posting,
  userId,
  owner,
}: {
  cvText: string;
  posting: ExtractedJob;
  userId: string;
  owner: KnownPii;
}): Promise<CvTweak[]> {
  const cv = redact(cvText, owner);
  const { object } = await generateStructured({
    schema: CvTweaksAnswer,
    system: CV_TWEAKS_SYSTEM,
    prompt: cvTweaksPrompt(posting, cv.text),
    feature: "CV_TWEAKS",
    userId,
    maxOutputTokens: 2500,
  });
  return verifyCvTweaks(object, cv.text, cv.map);
}
