import "server-only";
import { z } from "zod";
import { findSkillInText } from "@/lib/ai/skill-aliases";
import { generateStructured } from "@/lib/ai/provider";
import { PLACEHOLDER, redact, type KnownPii } from "@/lib/ai/redact";
import { fold } from "@/lib/text";

const MAX_ROLES = 3;
const MAX_SKILLS = 5;
const MAX_LEN = 60;

/** What is stored in Resume.profile: search words only, no personal data. */
export type CvProfile = { roles: string[]; skills: string[] };

export const CvProfileAnswer = z.object({
  roles: z.array(z.string()),
  skills: z.array(z.string()),
});

export const CV_PROFILE_SYSTEM = `Kamu membantu pencari kerja di Indonesia menentukan kata kunci untuk mencari lowongan dari CV-nya.
Teks CV sudah disamarkan (nama, kontak, dan alamat diganti tanda seperti [NAME_1]). Jangan menulis tanda itu.

roles: 1 sampai ${MAX_ROLES} nama jabatan yang paling cocok untuk dicari, urut dari yang paling cocok. Pakai nama jabatan umum di lowongan, bukan kalimat (contoh: "Frontend Developer", "Staff Administrasi"). Boleh disimpulkan dari pengalaman dan keahlian di CV.
skills: sampai ${MAX_SKILLS} keahlian utama yang TERTULIS di CV, urut dari yang paling menonjol. Hanya skill yang benar-benar ada di CV. Jangan menambah skill dari perkiraan.
Jangan mengarang. Kalau CV hampir kosong, kembalikan daftar yang pendek.`;

/** Drops what the AI shouldn't have returned: placeholders, long strings, duplicates, skills the CV doesn't mention. */
export function sanitizeProfile(answer: z.infer<typeof CvProfileAnswer>, redactedCv: string): CvProfile {
  const clean = (items: string[]) => {
    const seen = new Set<string>();
    return items
      .map((s) => s.replace(PLACEHOLDER, "").replace(/\s+/g, " ").trim())
      .filter((s) => s.length > 0 && s.length <= MAX_LEN && !seen.has(fold(s)) && !!seen.add(fold(s)));
  };
  return {
    roles: clean(answer.roles).slice(0, MAX_ROLES),
    skills: clean(answer.skills)
      .filter((s) => findSkillInText(s, redactedCv) !== null)
      .slice(0, MAX_SKILLS),
  };
}

/** One AI call on the redacted CV (only the relevant sections, no name or contact) → search words for the job portals. */
export async function generateCvProfile({
  cvText,
  owner,
  userId,
}: {
  cvText: string;
  owner: KnownPii;
  userId: string;
}): Promise<CvProfile> {
  const cv = redact(cvText, owner);
  const { object } = await generateStructured({
    schema: CvProfileAnswer,
    system: CV_PROFILE_SYSTEM,
    prompt: `CV:\n${cv.text}`,
    feature: "CV_PROFILE",
    userId,
    maxOutputTokens: 600,
  });
  return sanitizeProfile(object, cv.text);
}
