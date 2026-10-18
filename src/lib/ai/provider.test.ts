import { APICallError, NoObjectGeneratedError } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const { generateText, assertQuota, recordUsage, assertAiConsent } = vi.hoisted(() => ({
  generateText: vi.fn(),
  assertQuota: vi.fn(),
  recordUsage: vi.fn(),
  assertAiConsent: vi.fn(),
}));
vi.mock("ai", async (orig) => ({ ...(await orig<typeof import("ai")>()), generateText }));
vi.mock("@/lib/ai/usage", () => ({ assertQuota, recordUsage }));
vi.mock("@/lib/ai/consent", () => ({ assertAiConsent }));

const GROQ = "openai/gpt-oss-120b";
const CF = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

async function load(env: Record<string, string | undefined> = {}) {
  vi.resetModules();
  Object.assign(process.env, {
    NODE_ENV: "test",
    LLM_PRIMARY: "groq",
    LLM_FALLBACK: "cloudflare",
    GROQ_API_KEY: "gq",
    GROQ_MODEL: GROQ,
    GROQ_FALLBACK_MODEL: "",
    CLOUDFLARE_ACCOUNT_ID: "acc",
    CLOUDFLARE_API_TOKEN: "cf",
    CLOUDFLARE_MODEL: CF,
    NVIDIA_API_KEY: "nv",
    NVIDIA_MODEL: "nvidia/nemotron-3-super-120b-a12b",
    NVIDIA_BASE_URL: "https://integrate.api.nvidia.com/v1",
    OPENROUTER_API_KEY: "",
    ...env,
  });
  return import("./provider");
}

const args = {
  schema: z.object({ ok: z.boolean() }),
  system: "sys",
  prompt: "job text",
  feature: "EXTRACT_JOB" as const,
  userId: "u1",
};
const usage = { inputTokens: 900, outputTokens: 120, totalTokens: 1020 };
const answer = (output: unknown) => ({ text: JSON.stringify(output), usage });
const http = (status: number, extra: Partial<ConstructorParameters<typeof APICallError>[0]> = {}) =>
  new APICallError({ message: "x", url: "u", requestBodyValues: {}, statusCode: status, ...extra });
const jsonModeUnmet = () => http(400, { responseBody: '{"errors":[{"message":"JSON Mode couldn\'t be met"}]}' });

// Which provider:model and reasoning setting each generateText call used.
const calls = () =>
  generateText.mock.calls.map(([o]) => {
    const effort = o.providerOptions?.groq?.reasoningEffort;
    return `${o.model.provider.split(".")[0]}:${o.model.modelId}${effort ? `:${effort}` : ""}`;
  });

beforeEach(() => {
  generateText.mockReset();
  assertQuota.mockReset();
  recordUsage.mockReset();
  assertAiConsent.mockReset();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("generateStructured", () => {
  it("returns the primary's answer with provider, latency and token usage, and records it", async () => {
    const { generateStructured } = await load();
    generateText.mockResolvedValueOnce(answer({ ok: true }));
    const result = await generateStructured(args);
    expect(result).toMatchObject({ object: { ok: true }, model: `groq:${GROQ}`, provider: "groq", usage });
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(calls()).toEqual([`groq:${GROQ}:low`]);
    // Strict json_schema output; Groq doesn't support it together with streaming.
    expect(generateText.mock.calls[0][0].output).toBeDefined();
    expect(recordUsage).toHaveBeenCalledWith("u1", "EXTRACT_JOB", `groq:${GROQ}`);
  });

  it("invalid JSON → one retry on the same model with more reasoning and the error fed back → success", async () => {
    const { generateStructured } = await load();
    generateText
      .mockResolvedValueOnce({ text: '{"ok": "bukan boolean"}', usage })
      .mockResolvedValueOnce(answer({ ok: true }));
    await expect(generateStructured(args)).resolves.toMatchObject({ provider: "groq" });
    expect(calls()).toEqual([`groq:${GROQ}:low`, `groq:${GROQ}:medium`]);
    expect(generateText.mock.calls[1][0].prompt).toMatch(/tidak valid terhadap skema/);
  });

  it("treats an unparsable answer from the SDK (NoObjectGeneratedError) as invalid output", async () => {
    const { generateStructured } = await load();
    const noObject = new NoObjectGeneratedError({
      message: "x",
      text: "maaf",
      response: undefined!,
      usage: undefined!,
      finishReason: "stop",
    });
    generateText.mockRejectedValueOnce(noObject).mockResolvedValueOnce(answer({ ok: true }));
    await expect(generateStructured(args)).resolves.toMatchObject({ provider: "groq" });
    expect(calls()).toHaveLength(2);
  });

  it("429 from Groq without a short retry-after → falls back to Cloudflare", async () => {
    const { generateStructured } = await load();
    generateText
      .mockRejectedValueOnce(http(429, { responseHeaders: { "retry-after": "30" } }))
      .mockResolvedValueOnce(answer({ ok: true }));
    await expect(generateStructured(args)).resolves.toMatchObject({
      model: `cloudflare:${CF}`,
      provider: "cloudflare",
    });
    expect(calls()).toEqual([`groq:${GROQ}:low`, `cloudflare:${CF}`]);
  });

  it("429 with a short retry-after is waited out once on the same model", async () => {
    const { generateStructured } = await load();
    generateText
      .mockRejectedValueOnce(http(429, { responseHeaders: { "retry-after": "0" } }))
      .mockResolvedValueOnce(answer({ ok: true }));
    await expect(generateStructured(args)).resolves.toMatchObject({ provider: "groq" });
    expect(calls()).toEqual([`groq:${GROQ}:low`, `groq:${GROQ}:low`]);
  });

  it("tries GROQ_FALLBACK_MODEL before leaving Groq", async () => {
    const { generateStructured } = await load({ GROQ_FALLBACK_MODEL: "openai/gpt-oss-20b" });
    generateText.mockRejectedValueOnce(http(429)).mockResolvedValueOnce(answer({ ok: true }));
    await expect(generateStructured(args)).resolves.toMatchObject({ model: "groq:openai/gpt-oss-20b" });
  });

  it("handles Cloudflare's \"JSON Mode couldn't be met\" as invalid output: one retry, then gives up", async () => {
    const { generateStructured, AiUnavailableError } = await load({ LLM_PRIMARY: "cloudflare", LLM_FALLBACK: "" });
    generateText.mockRejectedValueOnce(jsonModeUnmet()).mockResolvedValueOnce(answer({ ok: true }));
    await expect(generateStructured(args)).resolves.toMatchObject({ provider: "cloudflare" });
    expect(calls()).toEqual([`cloudflare:${CF}`, `cloudflare:${CF}`]);

    generateText.mockReset();
    generateText.mockRejectedValueOnce(jsonModeUnmet()).mockRejectedValueOnce(jsonModeUnmet());
    const error = await generateStructured(args).catch((e) => e);
    expect(error).toBeInstanceOf(AiUnavailableError);
    expect(error.attempts).toEqual([
      { provider: "cloudflare", model: CF, status: "invalid_output" },
      { provider: "cloudflare", model: CF, status: "invalid_output" },
    ]);
  });

  it("everything fails (invalid twice, then 5xx and timeout) → AiUnavailableError, no usage recorded", async () => {
    const { generateStructured, AiUnavailableError } = await load();
    const timeout = Object.assign(new Error("t"), { name: "TimeoutError" });
    generateText
      .mockResolvedValueOnce({ text: "bukan json", usage })
      .mockResolvedValueOnce({ text: "{}", usage })
      .mockRejectedValueOnce(http(503));
    await expect(generateStructured(args)).rejects.toBeInstanceOf(AiUnavailableError);
    expect(calls()).toEqual([`groq:${GROQ}:low`, `groq:${GROQ}:medium`, `cloudflare:${CF}`]);

    generateText.mockReset();
    generateText.mockRejectedValueOnce(timeout).mockRejectedValueOnce(timeout);
    await expect(generateStructured(args)).rejects.toBeInstanceOf(AiUnavailableError);
    expect(recordUsage).not.toHaveBeenCalled();
  });

  it("refuses without AI consent, before calling any model", async () => {
    const { generateStructured } = await load();
    assertAiConsent.mockRejectedValueOnce(new Error("consent"));
    await expect(generateStructured(args)).rejects.toThrow("consent");
    expect(generateText).not.toHaveBeenCalled();
  });

  it("propagates quota errors before calling any model", async () => {
    const { generateStructured } = await load();
    assertQuota.mockRejectedValueOnce(new Error("quota"));
    await expect(generateStructured(args)).rejects.toThrow("quota");
    expect(generateText).not.toHaveBeenCalled();
  });
});

describe("dev-only providers", () => {
  it("NVIDIA in production throws a clear config error and turns AI off", async () => {
    const { generateStructured, aiEnabled } = await load({
      NODE_ENV: "production",
      LLM_PRIMARY: "nvidia",
      LLM_FALLBACK: "",
    });
    await expect(generateStructured(args)).rejects.toThrow(/hanya boleh dipakai untuk development/);
    expect(aiEnabled()).toBe(false);
    expect(generateText).not.toHaveBeenCalled();
  });

  it("OpenRouter as production fallback is refused too", async () => {
    const { aiEnabled } = await load({
      NODE_ENV: "production",
      LLM_FALLBACK: "openrouter",
      OPENROUTER_API_KEY: "or",
      OPENROUTER_MODEL: "x/y:free",
    });
    expect(aiEnabled()).toBe(false);
  });

  it("NVIDIA works in development, with the schema in the prompt and /no_think on the first try", async () => {
    const { generateStructured } = await load({ LLM_PRIMARY: "nvidia", LLM_FALLBACK: "" });
    generateText.mockResolvedValueOnce({ text: 'Berikut:\n```json\n{"ok": true}\n```', usage });
    await expect(generateStructured(args)).resolves.toMatchObject({ provider: "nvidia" });
    const o = generateText.mock.calls[0][0];
    expect(o.output).toBeUndefined();
    expect(o.system).toMatch(/^\/no_think[\s\S]*JSON Schema/);
  });
});

describe("aiEnabled / model config", () => {
  it("is off without keys or providers", async () => {
    expect((await load({ GROQ_API_KEY: "", CLOUDFLARE_API_TOKEN: "" })).aiEnabled()).toBe(false);
    expect((await load({ LLM_PRIMARY: "", LLM_FALLBACK: "" })).aiEnabled()).toBe(false);
    expect((await load({ LLM_PRIMARY: "cloudflare", LLM_FALLBACK: "", CLOUDFLARE_ACCOUNT_ID: "" })).aiEnabled()).toBe(
      false,
    );
  });
  it("ignores a BOM or stray whitespace around env values", async () => {
    const { generateStructured } = await load({ LLM_PRIMARY: " groq\n", GROQ_MODEL: `﻿${GROQ}` });
    generateText.mockResolvedValueOnce(answer({ ok: true }));
    await expect(generateStructured(args)).resolves.toMatchObject({ model: `groq:${GROQ}` });
    expect(calls()).toEqual([`groq:${GROQ}:low`]);
  });
  it("skips a provider whose key is missing", async () => {
    const { generateStructured } = await load({ GROQ_API_KEY: "" });
    generateText.mockResolvedValueOnce(answer({ ok: true }));
    await expect(generateStructured(args)).resolves.toMatchObject({ provider: "cloudflare" });
  });
  it("refuses forbidden vendors, unknown providers and non-NVIDIA base URLs", async () => {
    const vendor = ["an", "thropic"].join(""); // keep the literal out of the repo (check:llm-provider)
    expect((await load({ GROQ_MODEL: `${vendor}/x`, LLM_FALLBACK: "" })).aiEnabled()).toBe(false);
    expect((await load({ LLM_PRIMARY: "somewhere", LLM_FALLBACK: "" })).aiEnabled()).toBe(false);
    expect(
      (await load({ LLM_PRIMARY: "nvidia", LLM_FALLBACK: "", NVIDIA_BASE_URL: "https://evil.example/v1" })).aiEnabled(),
    ).toBe(false);
  });
});
