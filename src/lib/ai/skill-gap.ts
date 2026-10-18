import { z } from "zod";
import { findSkillInText } from "@/lib/ai/skill-aliases";
import { fold } from "@/lib/text";

export type GapRow = { skill: string; inResume: boolean; suggestion: string | null; sourceQuote: string | null };

/** No AI: skills the CV mentions verbatim or via an alias are marked found right away. */
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

/**
 * Checks on the LLM answer: one row per requested skill (missing answers → not found), and
 * "found" without a quote that really appears in the redacted CV is downgraded to not found.
 */
export function verifySkillGap(missing: string[], answer: SkillGapAnswer, redactedCv: string): GapRow[] {
  const cv = fold(redactedCv);
  return missing.map((skill) => {
    const r = answer.results.find((x) => fold(x.skill) === fold(skill));
    if (!r) return { skill, inResume: false, suggestion: null, sourceQuote: null };
    const quoteOk = !!r.quote && fold(r.quote).length > 0 && cv.includes(fold(r.quote));
    const inResume = r.inResume && quoteOk;
    return { skill, inResume, suggestion: r.suggestion, sourceQuote: inResume ? r.quote : null };
  });
}
