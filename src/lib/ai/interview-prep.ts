import { z } from "zod";
import { numbers } from "@/lib/ai/cv-tweaks";
import { rehydrate, type PiiMap } from "@/lib/ai/redact";
import { fold } from "@/lib/text";

export const MAX_QUESTIONS = 8;
export const MAX_QUESTIONS_TO_ASK = 3;
const MAX_POINTS = 5;

export const QUESTION_CATEGORIES = ["motivasi", "perilaku", "teknis", "situasional", "hr"] as const;
export const CATEGORY_LABELS: Record<(typeof QUESTION_CATEGORIES)[number], string> = {
  motivasi: "Motivasi",
  perilaku: "Perilaku",
  teknis: "Teknis",
  situasional: "Situasional",
  hr: "HR",
};

export const InterviewQuestion = z.object({
  category: z.enum(QUESTION_CATEGORIES),
  question: z.string(),
  why: z.string(), // why an interviewer asks this, tied to the posting
  quote: z.string().nullable(), // exact snippet of the posting that backs `why`
  answerPoints: z.array(z.string()), // what to cover, STAR-shaped; directions, not claims about the user
  cvQuote: z.string().nullable(), // exact snippet of the redacted CV the answer can build on
  tip: z.string(),
});
export type InterviewQuestion = z.infer<typeof InterviewQuestion>;

export const InterviewPrepAnswer = z.object({
  questions: z.array(InterviewQuestion),
  questionsToAsk: z.array(z.string()),
});
export type InterviewPrepAnswer = z.infer<typeof InterviewPrepAnswer>;

/** Which kind of interview a stage is, which sets the questions; null when the stage is not an interview. */
export type InterviewKind = "HR" | "USER" | "LGD" | "GENERAL";

const NOT_INTERVIEW = /psikotes|psikologi|\btpa\b|\btes\b|\btest\b|\bmcu\b|medical|kesehatan/i;

/** From the stage name, since stages are user-named. Closed stages and written tests/MCU get no preparation. */
export function interviewKindFor(stage: { name: string; kind: string }): InterviewKind | null {
  if (stage.kind === "REJECTED" || stage.kind === "WITHDRAWN") return null;
  if (NOT_INTERVIEW.test(stage.name)) return null;
  if (/\blgd\b|diskusi kelompok/i.test(stage.name)) return "LGD";
  if (/\bhr\b|\bhrd\b/i.test(stage.name)) return "HR";
  if (/\buser\b|teknis|technical|manager|manajer/i.test(stage.name)) return "USER";
  return "GENERAL";
}

/**
 * The model must not invent the user's story or the company's facts. An answer point is dropped when it carries
 * a number (percentage, year, amount) that is in none of the inputs, and a quote becomes null when it isn't in the
 * text the model saw. Duplicate questions go; at most 8 questions and 3 questions to ask remain. Personal data goes back in.
 */
export function verifyInterviewPrep(
  answer: InterviewPrepAnswer,
  input: { posting: string; redactedCv: string; known: string },
  map: PiiMap,
): InterviewPrepAnswer {
  const posting = fold(input.posting);
  const cv = fold(input.redactedCv);
  const allowed = new Set(numbers(`${input.posting}\n${input.redactedCv}\n${input.known}`));
  const inside = (quote: string | null, text: string) => {
    const q = quote ? fold(quote) : "";
    return q.length > 0 && text.includes(q) ? quote : null;
  };
  const seen = new Set<string>();
  const questions = answer.questions
    .filter((q) => {
      const key = fold(q.question);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_QUESTIONS)
    .map((q) => ({
      category: q.category,
      question: rehydrate(q.question.trim(), map),
      why: rehydrate(q.why.trim(), map),
      quote: inside(q.quote, posting) && rehydrate(q.quote!.trim(), map),
      answerPoints: q.answerPoints
        .map((p) => p.trim())
        .filter((p) => p && numbers(p).every((n) => allowed.has(n)))
        .slice(0, MAX_POINTS)
        .map((p) => rehydrate(p, map)),
      cvQuote: inside(q.cvQuote, cv) && rehydrate(q.cvQuote!.trim(), map),
      tip: rehydrate(q.tip.trim(), map),
    }));
  return {
    questions,
    questionsToAsk: answer.questionsToAsk
      .map((q) => q.trim())
      .filter(Boolean)
      .slice(0, MAX_QUESTIONS_TO_ASK)
      .map((q) => rehydrate(q, map)),
  };
}

/** What Application.interviewPrep holds for one stage: bounded, so it's safe to store. */
export const StoredInterviewPrep = z.object({
  stageName: z.string().max(200),
  kind: z.enum(["HR", "USER", "LGD", "GENERAL"]),
  generatedAt: z.string().max(40), // ISO timestamp
  usedPosting: z.boolean(), // false: made from company and position only
  usedCv: z.boolean(),
  questions: z
    .array(
      z.object({
        category: z.enum(QUESTION_CATEGORIES),
        question: z.string().max(1000),
        why: z.string().max(1000),
        quote: z.string().max(2000).nullable(),
        answerPoints: z.array(z.string().max(1000)).max(MAX_POINTS),
        cvQuote: z.string().max(2000).nullable(),
        tip: z.string().max(1000),
      }),
    )
    .max(MAX_QUESTIONS),
  questionsToAsk: z.array(z.string().max(1000)).max(MAX_QUESTIONS_TO_ASK),
});
export type StoredInterviewPrep = z.infer<typeof StoredInterviewPrep>;

/** Saved preparations by stage id, from the database (Json); malformed entries are skipped. */
export function readInterviewPrep(value: unknown): Record<string, StoredInterviewPrep> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, StoredInterviewPrep> = {};
  for (const [stageId, entry] of Object.entries(value)) {
    const parsed = StoredInterviewPrep.safeParse(entry);
    if (parsed.success) out[stageId] = parsed.data;
  }
  return out;
}
