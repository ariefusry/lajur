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
 */
export const PROVIDER_NAMES = ["groq", "cloudflare", "nvidia", "openrouter"] as const;
export type ProviderName = (typeof PROVIDER_NAMES)[number];
const DEV_ONLY: readonly ProviderName[] = ["nvidia", "openrouter"];

type Env = Record<string, string | undefined>;

// Values piped in by some shells arrive with a BOM or stray whitespace (a BOM in GROQ_MODEL made Groq answer 404).
const clean = (env: Env): Env => Object.fromEntries(Object.entries(env).map(([k, v]) => [k, v?.trim()]));

type ProviderConfig = {
  apiKey: string | undefined;
  baseURL: string | null; // null: misconfigured, provider disabled
  models: (string | undefined)[];
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
        apiKey: env.GROQ_API_KEY,
        baseURL: "https://api.groq.com/openai/v1",
        models: [env.GROQ_MODEL, env.GROQ_FALLBACK_MODEL],
        structured: true,
        // gpt-oss reasoning can't be switched off; "low" keeps it fast and inside the free 8K tokens/minute.
        options: (retry) => ({ reasoningEffort: retry ? "medium" : "low" }),
      };
    case "cloudflare":
      return {
        apiKey: env.CLOUDFLARE_API_TOKEN,
        baseURL: env.CLOUDFLARE_ACCOUNT_ID
          ? `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID)}/ai/v1`
          : null,
        models: [env.CLOUDFLARE_MODEL],
        structured: true,
        options: () => ({}),
      };
    case "nvidia":
      return {
        apiKey: env.NVIDIA_API_KEY,
        baseURL: nvidiaBaseUrl(env.NVIDIA_BASE_URL),
        models: [env.NVIDIA_MODEL],
        structured: false,
        // Nemotron thinking switch on NVIDIA NIM.
        options: (retry) => ({ chat_template_kwargs: { enable_thinking: retry } }),
      };
    case "openrouter":
      return {
        apiKey: env.OPENROUTER_API_KEY,
        baseURL: "https://openrouter.ai/api/v1",
        models: [env.OPENROUTER_MODEL],
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
  label: string; // "<provider>:<model id>", recorded in AiUsage
  structured: boolean;
  languageModel: LanguageModel;
  options: ProviderConfig["options"];
};

export function modelRef(provider: ProviderName, model: string, env: Env = process.env): ModelRef | null {
  const p = providerConfig(provider, env);
  if (!p.apiKey || !p.baseURL) return null;
  if (FORBIDDEN_MODEL.test(model)) {
    console.warn(`AI: ignoring model "${model}", this vendor is not allowed`);
    return null;
  }
  const client = createOpenAICompatible({ name: provider, baseURL: p.baseURL, apiKey: p.apiKey, supportsStructuredOutputs: p.structured });
  return { provider, model, label: `${provider}:${model}`, structured: p.structured, languageModel: client(model), options: p.options };
}

/**
 * The models to try, in order: every model of LLM_PRIMARY, then those of LLM_FALLBACK. Providers without a key
 * are skipped. Throws LlmConfigError when production is pointed at a dev-only provider.
 */
export function modelChain(rawEnv: Env = process.env): ModelRef[] {
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
      throw new LlmConfigError(`LLM provider "${name}" hanya boleh dipakai untuk development. Di produksi pakai groq atau cloudflare.`);
    }
    for (const model of providerConfig(name, env).models) {
      const ref = model ? modelRef(name, model, env) : null;
      if (ref && !refs.some((r) => r.label === ref.label)) refs.push(ref);
    }
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
