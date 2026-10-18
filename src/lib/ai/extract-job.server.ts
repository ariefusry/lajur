import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { EXTRACT_SYSTEM, ExtractedJob, hashJobText, isEmptyExtraction, verifyQuotes } from "@/lib/ai/extract-job";
import { generateStructured, type AiProgress } from "@/lib/ai/provider";
import { db } from "@/lib/db";

/** Nothing found in the text: usually a JS-rendered page or a login wall instead of the job ad. */
export class NothingFoundError extends Error {}

type Hooks = {
  onProgress?: (e: AiProgress) => void;
  onVerifying?: () => void;
};

/**
 * Cache → consent + quota → LLM → keep only items whose quote is in the text → cache.
 * `text` must already be normalized. Throws AiConsentRequiredError, QuotaExceededError, AiUnavailableError
 * or NothingFoundError.
 */
export async function extractJob(text: string, userId: string, hooks: Hooks = {}): Promise<{ job: ExtractedJob; cached: boolean }> {
  const textHash = hashJobText(text);
  const cached = await db.extractionCache.findUnique({ where: { textHash } });
  const hit = cached && ExtractedJob.safeParse(cached.result);
  if (hit?.success && !isEmptyExtraction(hit.data)) return { job: hit.data, cached: true };

  const { object, model } = await generateStructured({
    schema: ExtractedJob,
    system: EXTRACT_SYSTEM,
    prompt: text,
    feature: "EXTRACT_JOB",
    userId,
    onProgress: hooks.onProgress,
  });

  hooks.onVerifying?.();
  const job = verifyQuotes(object, text);
  if (isEmptyExtraction(job)) throw new NothingFoundError(); // don't cache an empty answer
  const result = job as unknown as Prisma.InputJsonValue;
  await db.extractionCache.upsert({ where: { textHash }, create: { textHash, result, model }, update: { result, model } });
  return { job, cached: false };
}
