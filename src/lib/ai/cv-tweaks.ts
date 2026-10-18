import { z } from "zod";
import { PLACEHOLDER, rehydrate, type PiiMap } from "@/lib/ai/redact";
import { findSkillInText } from "@/lib/ai/skill-aliases";
import { fold } from "@/lib/text";

export const MAX_CV_TWEAKS = 8;

export const CvTweak = z.object({
  // rewrite: polish text that is already in the CV (copy-ready); add: what to fill in, if the user really has it.
  kind: z.enum(["rewrite", "add"]),
  section: z.string(), // "Keahlian", "Pengalaman", …
  current: z.string().nullable(), // rewrite: exact snippet of the redacted CV; add: null
  suggestion: z.string(),
  reason: z.string(),
});
export type CvTweak = z.infer<typeof CvTweak>;

/** What Application.cvTweaks holds and the new-application form sends back: bounded, so it's safe to store. */
export const StoredCvTweaks = z
  .array(
    z.object({
      kind: z.enum(["rewrite", "add"]),
      section: z.string().max(200),
      current: z.string().max(4000).nullable(),
      suggestion: z.string().max(4000),
      reason: z.string().max(2000),
    }),
  )
  .max(MAX_CV_TWEAKS);

/** Saved tweaks from the database (Json), or [] when missing/malformed. */
export function readCvTweaks(value: unknown): CvTweak[] {
  return StoredCvTweaks.safeParse(value).data ?? [];
}

const numbers = (s: string) => s.replace(PLACEHOLDER, "").match(/\d+(?:[.,]\d+)*/g) ?? [];
// An "add" tip carrying a ready-made CV sentence in quotes ("misalnya: \"Frontend developer dengan pengalaman …\"").
const QUOTED_SAMPLE = /["“'‘][^"”'’]{30,}["”'’]/;

/**
 * The model must not put words in the user's mouth: a tweak is dropped when it
 * - rewrites text that isn't in the CV,
 * - introduces a number (year, GPA, amount, "5 halaman") the CV doesn't have,
 * - rewrites the CV to claim a posting skill the check found missing, or
 * - is an "add" tip that hands over a made-up CV sentence in quotes instead of saying what to add.
 * At most 8 survive; personal data goes back in.
 */
export function verifyCvTweaks(tweaks: CvTweak[], redactedCv: string, map: PiiMap, missingSkills: string[] = []): CvTweak[] {
  const cv = fold(redactedCv);
  const cvNumbers = new Set(numbers(redactedCv));
  return tweaks
    .filter((t) => {
      if (t.kind === "rewrite" && !(t.current && fold(t.current).length > 0 && cv.includes(fold(t.current)))) return false;
      if (numbers(t.suggestion).some((n) => !cvNumbers.has(n))) return false;
      if (t.kind === "add") return !QUOTED_SAMPLE.test(t.suggestion);
      return !missingSkills.some((skill) => findSkillInText(skill, t.suggestion));
    })
    .slice(0, MAX_CV_TWEAKS)
    .map((t) => ({
      kind: t.kind,
      section: t.section,
      current: t.kind === "rewrite" && t.current ? rehydrate(t.current, map) : null,
      suggestion: rehydrate(t.suggestion, map),
      reason: rehydrate(t.reason, map),
    }));
}
