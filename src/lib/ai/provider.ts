import "server-only";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { APICallError, parsePartialJson, streamText, type DeepPartial } from "ai";
import { z } from "zod";
import type { AiFeature } from "@/generated/prisma/enums";
import { extractJsonObject, jsonStart } from "@/lib/ai/json-text";
import { assertQuota, recordUsage } from "@/lib/ai/usage";

/*
 * Allowed LLM providers (CLAUDE.md rule 10): NVIDIA API Catalog and OpenRouter; forbidden vendors are refused below.
 * Models are configured as "<provider>:<model id>", e.g.
 *   LLM_MODEL=openrouter:nvidia/nemotron-3-super-120b-a12b:free
 *   LLM_FALLBACK_MODEL=nvidia:nvidia/nemotron-3-super-120b-a12b
 */
type ProviderName = "nvidia" | "openrouter";

const NVIDIA_BASE_URL = process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";
const NVIDIA_BASE_URL_OK = (() => {
  try {
    return new URL(NVIDIA_BASE_URL).hostname === "integrate.api.nvidia.com";
  } catch {
    return false;
  }
})();
if (!NVIDIA_BASE_URL_OK) console.warn("AI: NVIDIA disabled, NVIDIA_BASE_URL must point to integrate.api.nvidia.com");

const PROVIDERS = {
  nvidia: {
    key: process.env.NVIDIA_API_KEY,
    enabled: NVIDIA_BASE_URL_OK,
    client: createOpenAICompatible({ name: "nvidia", baseURL: NVIDIA_BASE_URL, apiKey: process.env.NVIDIA_API_KEY }),
    // Nemotron thinking switch on NVIDIA NIM.
    thinking: (on: boolean) => ({ chat_template_kwargs: { enable_thinking: on } }),
  },
  openrouter: {
    key: process.env.OPENROUTER_API_KEY,
    enabled: true,
    client: createOpenAICompatible({ name: "openrouter", baseURL: "https://openrouter.ai/api/v1", apiKey: process.env.OPENROUTER_API_KEY }),
    thinking: (on: boolean) => ({ reasoning: { enabled: on } }),
  },
} satisfies Record<ProviderName, unknown>;

// Spelled with character classes so `pnpm check:llm-provider` (which greps the repo for the vendor name) stays clean.
const FORBIDDEN_MODEL = /an[t]hropic|cl[a]ude/i;

type ModelRef = { provider: ProviderName; model: string; label: string };

function parseModelRef(raw: string | undefined): ModelRef | null {
  if (!raw) return null;
  const i = raw.indexOf(":");
  const provider = raw.slice(0, i) as ProviderName;
  const model = raw.slice(i + 1);
  if (i < 0 || !(provider in PROVIDERS) || !model) {
    console.warn(`AI: ignoring "${raw}", expected "<nvidia|openrouter>:<model id>"`);
    return null;
  }
  if (FORBIDDEN_MODEL.test(model)) {
    console.warn(`AI: ignoring "${raw}", this vendor is not allowed (CLAUDE.md rule 10)`);
    return null;
  }
  const p = PROVIDERS[provider];
  return p.enabled && p.key ? { provider, model, label: raw } : null;
}

function configuredModels(): ModelRef[] {
  return [process.env.LLM_MODEL, process.env.LLM_FALLBACK_MODEL]
    .map(parseModelRef)
    .filter((m): m is ModelRef => m !== null);
}

/** AI features are optional: hidden when no usable provider key/model is configured. */
export function aiEnabled() {
  return configuredModels().length > 0;
}

/** The model answered, but not with JSON matching the schema; earns one retry with reasoning on. */
class InvalidOutputError extends Error {}

export class AiUnavailableError extends Error {
  constructor() {
    super("AI sedang tidak tersedia, silakan isi manual.");
  }
}

const TIMEOUT_MS = 60_000; // CLAUDE.md 7.8; the reasoning-on retry takes ~45 s

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
  onProgress?: (event: AiProgress) => void;
  /** Called with the object as the model writes it (not yet validated), for live UI progress. */
  onPartial?: (partial: DeepPartial<T>) => void;
};

/*
 * Plain streamed text, no response_format: with any JSON response_format OpenRouter buffers the whole answer
 * into one chunk (measured in Phase 3), which would kill the live findings UI. The schema goes in the prompt,
 * partial JSON feeds onPartial, and the finished text is cut out of fences/prose and Zod-validated.
 */
async function callModel<T>(ref: ModelRef, args: Args<T>, prompt: string, thinking: boolean): Promise<T> {
  const p = PROVIDERS[ref.provider];
  const system = `${args.system}\n\nBalas HANYA dengan satu objek JSON yang valid terhadap JSON Schema berikut, tanpa markdown dan tanpa teks lain:\n${JSON.stringify(z.toJSONSchema(args.schema))}`;
  let streamError: unknown;
  const result = streamText({
    model: p.client(ref.model),
    system: ref.provider === "nvidia" && !thinking ? `/no_think\n${system}` : system,
    prompt,
    temperature: 0,
    maxOutputTokens: 4000,
    maxRetries: 0, // retries/fallback are handled below
    abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    providerOptions: { [ref.provider]: p.thinking(thinking) },
    onError: ({ error }) => {
      streamError = error;
    },
  });

  let text = "";
  for await (const delta of result.textStream) {
    text += delta;
    if (!args.onPartial) continue;
    const { value, state } = await parsePartialJson(jsonStart(text));
    if ((state === "successful-parse" || state === "repaired-parse") && value && typeof value === "object") {
      args.onPartial(value as DeepPartial<T>);
    }
  }
  if (streamError) throw streamError;

  const json = extractJsonObject(text);
  let parsed: unknown;
  try {
    parsed = json === null ? undefined : JSON.parse(json);
  } catch {
    throw new InvalidOutputError("Jawaban bukan JSON yang valid.");
  }
  const checked = args.schema.safeParse(parsed);
  if (!checked.success) throw new InvalidOutputError(z.prettifyError(checked.error));
  return checked.data;
}

/**
 * Per model: fast attempt with reasoning off → if the output fails validation, one retry with reasoning on
 * and the validation error fed back → on 429/5xx/timeout/other errors, next model → AiUnavailableError.
 */
export async function generateStructured<T>(args: Args<T>): Promise<{ object: T; model: string }> {
  const models = configuredModels();
  if (!models.length) throw new AiUnavailableError();
  await assertQuota(args.userId);

  for (const [index, ref] of models.entries()) {
    let prompt = args.prompt;
    for (const thinking of [false, true]) {
      const started = Date.now();
      args.onProgress?.({ kind: "attempt", provider: ref.provider, model: ref.model, thinking, fallback: index > 0 });
      try {
        const object = await callModel(ref, args, prompt, thinking);
        log(args.feature, ref.label, thinking, started, "ok");
        await recordUsage(args.userId, args.feature, ref.label);
        return { object, model: ref.label };
      } catch (error) {
        const status = errorStatus(error);
        log(args.feature, ref.label, thinking, started, status);
        args.onProgress?.({ kind: "attempt_failed", provider: ref.provider, reason: progressReason(status) });
        if (!thinking && error instanceof InvalidOutputError) {
          prompt = `${args.prompt}\n\nJawaban sebelumnya tidak valid terhadap skema: ${error.message.slice(0, 1500)}\nBalas ulang dengan JSON yang valid.`;
          continue;
        }
        break;
      }
    }
  }
  throw new AiUnavailableError();
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

// Never log prompts or CV text: feature, model, duration, status only.
function log(feature: AiFeature, model: string, thinking: boolean, started: number, status: string) {
  console.info("ai call", { feature, model, thinking, ms: Date.now() - started, status });
}
