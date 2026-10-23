// One structured LLM call the way src/lib/ai/provider.ts makes it (that file is server-only and uses path
// aliases, so scripts can't import it). Provider setup itself is shared via llm-config.ts.
import { generateText, jsonSchema, Output } from "ai";
import { z } from "zod";
import { extractJsonObject } from "../src/lib/ai/json-text.ts";
import { PROVIDER_NAMES, modelRef, providerConfig, responseSchema, type ModelRef } from "../src/lib/ai/llm-config.ts";

/** Every model configured in the env, per provider, regardless of LLM_PRIMARY/LLM_FALLBACK. Never prints keys. */
export function configuredRefs(only?: readonly string[]) {
  const refs: ModelRef[] = [];
  const skipped: string[] = [];
  for (const name of PROVIDER_NAMES) {
    if (only && !only.includes(name)) continue;
    const p = providerConfig(name);
    const models = p.models.filter((m): m is string => !!m);
    const missing = [!p.apiKeys[0] && "API key", !p.baseURL && "base URL/account ID", !models.length && "model"].filter(
      Boolean,
    );
    if (missing.length) {
      skipped.push(`${name}: belum ada ${missing.join(", ")} di .env.local`);
      continue;
    }
    for (const model of models) {
      const ref = modelRef(name, model);
      if (ref) refs.push(ref);
    }
  }
  return { refs, skipped };
}

export async function callOnce<T>(ref: ModelRef, schema: z.ZodType<T>, system: string, prompt: string, retry = false) {
  const json = responseSchema(schema);
  const started = Date.now();
  const result = await generateText({
    model: ref.languageModel,
    system: ref.structured
      ? system
      : `${ref.provider === "nvidia" && !retry ? "/no_think\n" : ""}${system}\n\nBalas HANYA dengan satu objek JSON yang valid terhadap JSON Schema berikut, tanpa markdown dan tanpa teks lain:\n${JSON.stringify(json)}`,
    prompt,
    temperature: 0,
    maxOutputTokens: 3000,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(30_000),
    providerOptions: { [ref.provider]: ref.options(retry) },
    ...(ref.structured && { output: Output.object({ schema: jsonSchema(json), name: "result" }) }),
  });
  const parsed = schema.safeParse(JSON.parse(extractJsonObject(result.text) ?? "null"));
  return {
    ms: Date.now() - started,
    tokensIn: result.usage.inputTokens,
    tokensOut: result.usage.outputTokens,
    data: parsed.success ? parsed.data : null,
    schemaError: parsed.success ? null : z.prettifyError(parsed.error).slice(0, 100),
  };
}

/** Error summary without request bodies (they hold the prompt) or headers (they hold the key). */
export function describeError(error: unknown) {
  const e = error as Error & { statusCode?: number; responseBody?: string };
  const body = e.responseBody ? ` ${e.responseBody.slice(0, 120)}` : "";
  return `${e.name}${e.statusCode ? ` ${e.statusCode}` : ""}: ${e.message.slice(0, 100)}${body}`;
}
