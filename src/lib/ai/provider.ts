import "server-only";
import { APICallError, generateText, jsonSchema, NoObjectGeneratedError, Output, type LanguageModelUsage } from "ai";
import { z } from "zod";
import type { AiFeature } from "@/generated/prisma/enums";
import { assertAiConsent } from "@/lib/ai/consent";
import { extractJsonObject } from "@/lib/ai/json-text";
import { modelChain, responseSchema, type ModelRef, type ProviderName } from "@/lib/ai/llm-config";
import { assertQuota, recordUsage } from "@/lib/ai/usage";

/** AI features are optional: hidden when no usable provider key/model is configured. */
export function aiEnabled() {
  try {
    return modelChain().length > 0;
  } catch (error) {
    console.error("AI disabled:", error instanceof Error ? error.message : error);
    return false;
  }
}

/** The model answered, but not with JSON matching the schema; earns one retry with more reasoning. */
class InvalidOutputError extends Error {}

export type AiAttempt = { provider: ProviderName; model: string; status: string };

export class AiUnavailableError extends Error {
  constructor(readonly attempts: AiAttempt[] = []) {
    super("AI sedang tidak tersedia, silakan isi manual.");
  }
}

const TIMEOUT_MS = 30_000;
// Groq's free tier allows 8K tokens/minute (input + output); inputs are capped by the callers to stay well inside.
const MAX_OUTPUT_TOKENS = 3000;
const MAX_RETRY_AFTER_MS = 3000; // a longer 429 wait goes to the next model instead

/** Progress events for the UI: which model is being tried, in which mode, and how the last try ended. */
export type AiProgress =
  | { kind: "attempt"; provider: ProviderName; model: string; thinking: boolean; fallback: boolean }
  | { kind: "attempt_failed"; provider: ProviderName; reason: "invalid_output" | "busy" | "timeout" | "error" };

type Args<T> = {
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  feature: AiFeature;
  userId: string;
  maxOutputTokens?: number;
  onProgress?: (event: AiProgress) => void;
};

export type AiResult<T> = {
  object: T;
  model: string; // "<provider>:<model id>"
  provider: ProviderName;
  latencyMs: number;
  usage: Pick<LanguageModelUsage, "inputTokens" | "outputTokens" | "totalTokens">;
};

/*
 * Not streamed: Groq's strict json_schema and Cloudflare's JSON mode don't support streaming (decided 2026-10-19).
 * Providers without response_format support get the schema in the prompt; either way the answer is Zod-checked.
 */
async function callModel<T>(ref: ModelRef, args: Args<T>, prompt: string, retry: boolean) {
  const schema = responseSchema(args.schema);
  const system = ref.structured
    ? args.system
    : `${args.system}\n\nBalas HANYA dengan satu objek JSON yang valid terhadap JSON Schema berikut, tanpa markdown dan tanpa teks lain:\n${JSON.stringify(schema)}`;
  let result;
  try {
    result = await generateText({
      model: ref.languageModel,
      system: ref.provider === "nvidia" && !retry ? `/no_think\n${system}` : system,
      prompt,
      temperature: 0,
      maxOutputTokens: args.maxOutputTokens ?? MAX_OUTPUT_TOKENS,
      maxRetries: 0, // retries/fallback are handled below
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
      providerOptions: { [ref.provider]: ref.options(retry) },
      ...(ref.structured && { output: Output.object({ schema: jsonSchema(schema), name: "result" }) }),
    });
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) throw new InvalidOutputError("Jawaban bukan JSON yang valid.");
    // Cloudflare's JSON mode can refuse a schema it couldn't satisfy; treated like any other invalid answer.
    if (APICallError.isInstance(error) && /JSON Mode couldn't be met/i.test(`${error.message} ${error.responseBody ?? ""}`)) {
      throw new InvalidOutputError("JSON Mode couldn't be met");
    }
    throw error;
  }

  const json = extractJsonObject(result.text);
  let parsed: unknown;
  try {
    parsed = json === null ? undefined : JSON.parse(json);
  } catch {
    throw new InvalidOutputError("Jawaban bukan JSON yang valid.");
  }
  const checked = args.schema.safeParse(parsed);
  if (!checked.success) throw new InvalidOutputError(z.prettifyError(checked.error));
  const { inputTokens, outputTokens, totalTokens } = result.usage;
  return { object: checked.data, usage: { inputTokens, outputTokens, totalTokens } };
}

/**
 * Per model: first try → if the output fails validation, one retry with more reasoning and the validation error
 * fed back → a 429 with a short retry-after is waited out once → otherwise (429/5xx/timeout/still invalid) the next
 * model → AiUnavailableError. Throws AiConsentRequiredError, QuotaExceededError or LlmConfigError before any call.
 */
export async function generateStructured<T>(args: Args<T>): Promise<AiResult<T>> {
  const models = modelChain();
  if (!models.length) throw new AiUnavailableError();
  await assertAiConsent(args.userId);
  await assertQuota(args.userId);

  const attempts: AiAttempt[] = [];
  for (const [index, ref] of models.entries()) {
    let prompt = args.prompt;
    let retry = false;
    let waited = false;
    for (;;) {
      const started = Date.now();
      args.onProgress?.({ kind: "attempt", provider: ref.provider, model: ref.model, thinking: retry, fallback: index > 0 });
      try {
        const { object, usage } = await callModel(ref, args, prompt, retry);
        const latencyMs = Date.now() - started;
        log(args.feature, ref.label, retry, latencyMs, "ok", usage);
        await recordUsage(args.userId, args.feature, ref.label);
        return { object, model: ref.label, provider: ref.provider, latencyMs, usage };
      } catch (error) {
        const status = errorStatus(error);
        log(args.feature, ref.label, retry, Date.now() - started, status);
        attempts.push({ provider: ref.provider, model: ref.model, status });
        args.onProgress?.({ kind: "attempt_failed", provider: ref.provider, reason: progressReason(status) });
        if (!retry && error instanceof InvalidOutputError) {
          retry = true;
          prompt = `${args.prompt}\n\nJawaban sebelumnya tidak valid terhadap skema: ${error.message.slice(0, 1500)}\nBalas ulang dengan JSON yang valid.`;
          continue;
        }
        const wait = status === "http_429" && !waited ? retryAfterMs(error) : null;
        if (wait !== null && wait <= MAX_RETRY_AFTER_MS) {
          waited = true;
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        break;
      }
    }
  }
  throw new AiUnavailableError(attempts);
}

/** retry-after in ms (seconds or an HTTP date), or null when the provider didn't send one. */
function retryAfterMs(error: unknown): number | null {
  const raw = APICallError.isInstance(error) ? error.responseHeaders?.["retry-after"] : undefined;
  if (!raw) return null;
  const ms = /^\d+(\.\d+)?$/.test(raw.trim()) ? Number(raw) * 1000 : Date.parse(raw) - Date.now();
  return Number.isFinite(ms) ? Math.max(0, ms) : null;
}

function progressReason(status: string): Extract<AiProgress, { kind: "attempt_failed" }>["reason"] {
  if (status === "invalid_output" || status === "timeout") return status;
  return /^http_(429|5)/.test(status) ? "busy" : "error";
}

function errorStatus(error: unknown) {
  if (APICallError.isInstance(error)) return `http_${error.statusCode ?? "?"}`;
  if (error instanceof InvalidOutputError) return "invalid_output";
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return "timeout";
  return "error";
}

// Never log prompts, CV text or keys: feature, model, duration, tokens, status only.
function log(feature: AiFeature, model: string, retry: boolean, ms: number, status: string, usage?: AiResult<unknown>["usage"]) {
  console.info("ai call", { feature, model, retry, ms, status, tokensIn: usage?.inputTokens, tokensOut: usage?.outputTokens });
}
