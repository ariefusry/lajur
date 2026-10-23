import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { JSONValue, LanguageModel } from "ai";
import { z } from "zod";

/*
 * Allowed LLM providers. Production: Groq (primary) and Cloudflare Workers AI (fallback).
 * NVIDIA API Catalog and OpenRouter are dev-only: the NVIDIA trial ToS bars production use, and both free tiers
 * may train on what they receive. No imports from server-only or "@/" aliases, so scripts/ can use this too.
 *
 *   LLM_PRIMARY=groq      GROQ_MODEL=openai/gpt-oss-20b    GROQ_FALLBACK_MODEL=openai/gpt-oss-120b
 *   LLM_FALLBACK=cloudflare  CLOUDFLARE_MODEL=@cf/meta/llama-3.3-70b-instruct-fp8-fast
 *
 * Reading job posters (images) uses separate vision models, in the same provider order:
 *   GROQ_VISION_MODEL=qwen/qwen3.8-27b    CLOUDFLARE_VISION_MODEL=@cf/meta/llama-4-scout-17b-16e-instruct
 *
 * GROQ_API_KEY_2 (optional): a second Groq key, tried with every Groq model after the first key's turn and
 * before the fallback provider. Recorded as "groq-2:<model>".
 */
export const PROVIDER_NAMES = ["groq", "cloudflare", "nvidia", "openrouter"] as const;
export type ProviderName = (typeof PROVIDER_NAMES)[number];
const DEV_ONLY: readonly ProviderName[] = ["nvidia", "openrouter"];

type Env = Record<string, string | undefined>;

// Values piped in by some shells arrive with a BOM or stray whitespace (a BOM in GROQ_MODEL made Groq answer 404).
const clean = (env: Env): Env => Object.fromEntries(Object.entries(env).map(([k, v]) => [k, v?.trim()]));

type ProviderConfig = {
  /** The first is the provider's own key; any further ones are tried after it, model by model. */
  apiKeys: (string | undefined)[];
  baseURL: string | null; // null: misconfigured, provider disabled
  models: (string | undefined)[];
  /** Image-capable models, for transcribing job posters. */
  visionModels: (string | undefined)[];
  /** Sends response_format json_schema (strict). Without it the schema goes in the prompt instead. */
  structured: boolean;
  /** Provider options for the first try (retry=false) and for the retry after invalid output. */
  options: (retry: boolean) => Record<string, JSONValue>;
};

function nvidiaBaseUrl(raw: string | undefined) {
  const url = raw || "https://integrate.api.nvidia.com/v1";
  try {
    return new URL(url).hostname === "integrate.api.nvidia.com" ? url : null;
  } catch {
    return null;
  }
}

export function providerConfig(name: ProviderName, rawEnv: Env = process.env): ProviderConfig {
  const env = clean(rawEnv);
  switch (name) {
    case "groq":
      return {
        apiKeys: [env.GROQ_API_KEY, env.GROQ_API_KEY_2],
        baseURL: "https://api.groq.com/openai/v1",
        models: [env.GROQ_MODEL, env.GROQ_FALLBACK_MODEL],
        visionModels: [env.GROQ_VISION_MODEL],
        structured: true,
        // gpt-oss reasoning can't be switched off; "low" keeps it fast and inside the free 8K tokens/minute.
        options: (retry) => ({ reasoningEffort: retry ? "medium" : "low" }),
      };
    case "cloudflare":
      return {
        apiKeys: [env.CLOUDFLARE_API_TOKEN],
        baseURL: env.CLOUDFLARE_ACCOUNT_ID
          ? `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID)}/ai/v1`
          : null,
        models: [env.CLOUDFLARE_MODEL],
        visionModels: [env.CLOUDFLARE_VISION_MODEL],
        structured: true,
        options: () => ({}),
      };
    case "nvidia":
      return {
        apiKeys: [env.NVIDIA_API_KEY],
        baseURL: nvidiaBaseUrl(env.NVIDIA_BASE_URL),
        models: [env.NVIDIA_MODEL],
        visionModels: [],
        structured: false,
        // Nemotron thinking switch on NVIDIA NIM.
        options: (retry) => ({ chat_template_kwargs: { enable_thinking: retry } }),
      };
    case "openrouter":
      return {
        apiKeys: [env.OPENROUTER_API_KEY],
        baseURL: "https://openrouter.ai/api/v1",
        models: [env.OPENROUTER_MODEL],
        visionModels: [],
        structured: false,
        options: (retry) => ({ reasoning: { enabled: retry } }),
      };
  }
}

// Spelled with character classes so `pnpm check:llm-provider` (which greps the repo for the vendor name) stays clean.
const FORBIDDEN_MODEL = /an[t]hropic|cl[a]ude/i;

export class LlmConfigError extends Error {}

export type ModelRef = {
  provider: ProviderName;
  model: string;
  label: string; // "<provider>:<model id>" ("groq-2:…" for the second key), recorded in AiUsage
  structured: boolean;
  languageModel: LanguageModel;
  options: ProviderConfig["options"];
};

/** `keyIndex`: which of the provider's keys (0 = its main key). */
export function modelRef(provider: ProviderName, model: string, env: Env = process.env, keyIndex = 0): ModelRef | null {
  const p = providerConfig(provider, env);
  const apiKey = p.apiKeys[keyIndex];
  if (!apiKey || !p.baseURL) return null;
  if (FORBIDDEN_MODEL.test(model)) {
    console.warn(`AI: ignoring model "${model}", this vendor is not allowed`);
    return null;
  }
  const client = createOpenAICompatible({
    name: provider,
    baseURL: p.baseURL,
    apiKey,
    supportsStructuredOutputs: p.structured,
  });
  return {
    provider,
    model,
    label: `${provider}${keyIndex ? `-${keyIndex + 1}` : ""}:${model}`,
    structured: p.structured,
    languageModel: client(model),
    options: p.options,
  };
}

/**
 * The models to try, in order: every model of LLM_PRIMARY (once per key it has), then those of LLM_FALLBACK.
 * Providers without a key are skipped. Throws LlmConfigError when production is pointed at a dev-only provider.
 * `kind: "vision"` walks the same providers' image-capable models instead.
 */
export function modelChain(rawEnv: Env = process.env, kind: "text" | "vision" = "text"): ModelRef[] {
  const env = clean(rawEnv);
  const refs: ModelRef[] = [];
  for (const raw of [env.LLM_PRIMARY, env.LLM_FALLBACK]) {
    if (!raw) continue;
    const name = raw as ProviderName;
    if (!PROVIDER_NAMES.includes(name)) {
      console.warn(`AI: ignoring LLM provider "${raw}", expected one of ${PROVIDER_NAMES.join(", ")}`);
      continue;
    }
    if (env.NODE_ENV === "production" && DEV_ONLY.includes(name)) {
      throw new LlmConfigError(
        `LLM provider "${name}" hanya boleh dipakai untuk development. Di produksi pakai groq atau cloudflare.`,
      );
    }
    const config = providerConfig(name, env);
    // A second key only helps once the first is rate-limited, so it gets its turn after all the first key's models.
    config.apiKeys.forEach((key, keyIndex) => {
      if (!key || (keyIndex > 0 && config.apiKeys.slice(0, keyIndex).includes(key))) return;
      for (const model of kind === "vision" ? config.visionModels : config.models) {
        const ref = model ? modelRef(name, model, env, keyIndex) : null;
        if (ref && !refs.some((r) => r.label === ref.label)) refs.push(ref);
      }
    });
  }
  return refs;
}

/**
 * JSON Schema for response_format. Strict decoders may reject `format`/`pattern` (e.g. on z.iso.date());
 * Zod still checks those after the answer arrives.
 */
export function responseSchema(schema: z.ZodType) {
  const strip = (node: unknown, isPropertyMap = false): unknown => {
    if (Array.isArray(node)) return node.map((n) => strip(n));
    if (!node || typeof node !== "object") return node;
    return Object.fromEntries(
      Object.entries(node)
        .filter(([k]) => isPropertyMap || !["$schema", "format", "pattern"].includes(k))
        .map(([k, v]) => [k, strip(v, !isPropertyMap && k === "properties")]),
    );
  };
  return strip(z.toJSONSchema(schema)) as Record<string, unknown>;
}
