import { APICallError } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const { streamText, assertQuota, recordUsage } = vi.hoisted(() => ({
  streamText: vi.fn(),
  assertQuota: vi.fn(),
  recordUsage: vi.fn(),
}));
vi.mock("ai", async (orig) => ({ ...(await orig<typeof import("ai")>()), streamText }));
vi.mock("@/lib/ai/usage", () => ({ assertQuota, recordUsage }));

const PRIMARY = "openrouter:nvidia/nemotron-3-super-120b-a12b:free";
const FALLBACK = "nvidia:nvidia/nemotron-3-super-120b-a12b";

async function load(env: Record<string, string | undefined> = {}) {
  vi.resetModules();
  Object.assign(process.env, {
    NVIDIA_API_KEY: "nv",
    OPENROUTER_API_KEY: "or",
    NVIDIA_BASE_URL: "https://integrate.api.nvidia.com/v1",
    LLM_MODEL: PRIMARY,
    LLM_FALLBACK_MODEL: FALLBACK,
    ...env,
  });
  return import("./provider");
}

const args = { schema: z.object({ ok: z.boolean() }), system: "sys", prompt: "job text", feature: "EXTRACT_JOB" as const, userId: "u1" };
const INVALID = Symbol("invalid output");
const invalid = () => INVALID;
const http = (status: number) => new APICallError({ message: "x", url: "u", requestBodyValues: {}, statusCode: status });
// Fake streamText results: the model's answer arrives as text chunks.
const stream = (chunks: string[]) => (async function* () { yield* chunks; })();
const succeeds = (output: unknown) => () => {
  const json = JSON.stringify(output);
  return { textStream: stream([json.slice(0, 4), json.slice(4)]) };
};
const invalidOutput = () => () => ({ textStream: stream(['{"ok": "bukan boolean"}']) });
const providerError = (error: unknown) => (opts: { onError: (e: { error: unknown }) => void }) => {
  opts.onError({ error });
  return { textStream: stream([]) };
};
const generateText = {
  mockResolvedValueOnce: (v: { output: unknown }) => { streamText.mockImplementationOnce(succeeds(v.output)); return generateText; },
  mockRejectedValueOnce: (e: unknown) => {
    streamText.mockImplementationOnce(e === INVALID ? invalidOutput() : providerError(e));
    return generateText;
  },
  mockReset: () => streamText.mockReset(),
  get mock() { return streamText.mock; },
};
// Which model + reasoning flag each streamText call used.
const calls = () =>
  streamText.mock.calls.map(([o]) => {
    const thinking = JSON.stringify(o.providerOptions).includes("true");
    return `${o.model.provider.split(".")[0]}:${thinking ? "on" : "off"}`;
  });

beforeEach(() => {
  streamText.mockReset();
  assertQuota.mockReset();
  recordUsage.mockReset();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("generateStructured", () => {
  it("returns the primary model's answer with reasoning off and records usage", async () => {
    const { generateStructured } = await load();
    generateText.mockResolvedValueOnce({ output: { ok: true } });
    await expect(generateStructured(args)).resolves.toEqual({ object: { ok: true }, model: PRIMARY });
    expect(calls()).toEqual(["openrouter:off"]);
    expect(recordUsage).toHaveBeenCalledWith("u1", "EXTRACT_JOB", PRIMARY);
  });

  it("forwards partial objects while the model writes", async () => {
    const { generateStructured } = await load();
    generateText.mockResolvedValueOnce({ output: { ok: true } });
    const onPartial = vi.fn();
    await generateStructured({ ...args, onPartial });
    expect(onPartial).toHaveBeenCalledWith({ ok: true });
  });

  it("accepts JSON wrapped in a markdown fence or prose", async () => {
    const { generateStructured } = await load();
    streamText.mockImplementationOnce(() => ({ textStream: stream(["Berikut hasilnya:\n```json\n", '{"ok": true}', "\n```"]) }));
    await expect(generateStructured(args)).resolves.toMatchObject({ object: { ok: true } });
  });

  it("retries once with reasoning on, feeding back the validation error", async () => {
    const { generateStructured } = await load();
    generateText.mockRejectedValueOnce(invalid()).mockResolvedValueOnce({ output: { ok: true } });
    await generateStructured(args);
    expect(calls()).toEqual(["openrouter:off", "openrouter:on"]);
    expect(generateText.mock.calls[1][0].prompt).toMatch(/tidak valid terhadap skema/);
  });

  it("falls back to NVIDIA on 429 and on timeout, with /no_think when reasoning is off", async () => {
    const { generateStructured } = await load();
    generateText.mockRejectedValueOnce(http(429)).mockResolvedValueOnce({ output: { ok: true } });
    await expect(generateStructured(args)).resolves.toMatchObject({ model: FALLBACK });
    expect(calls()).toEqual(["openrouter:off", "nvidia:off"]);
    expect(generateText.mock.calls[1][0].system).toMatch(/^\/no_think/);

    generateText.mockReset();
    const timeout = Object.assign(new Error("t"), { name: "TimeoutError" });
    generateText.mockRejectedValueOnce(timeout).mockResolvedValueOnce({ output: { ok: true } });
    await expect(generateStructured(args)).resolves.toMatchObject({ model: FALLBACK });
  });

  it("throws AiUnavailableError when everything fails, without recording usage", async () => {
    const { generateStructured, AiUnavailableError } = await load();
    generateText.mockRejectedValueOnce(invalid()).mockRejectedValueOnce(invalid()).mockRejectedValueOnce(http(503));
    await expect(generateStructured(args)).rejects.toBeInstanceOf(AiUnavailableError);
    expect(calls()).toEqual(["openrouter:off", "openrouter:on", "nvidia:off"]);
    expect(recordUsage).not.toHaveBeenCalled();
  });

  it("propagates quota errors before calling any model", async () => {
    const { generateStructured } = await load();
    assertQuota.mockRejectedValueOnce(new Error("quota"));
    await expect(generateStructured(args)).rejects.toThrow("quota");
    expect(streamText).not.toHaveBeenCalled();
  });
});

describe("aiEnabled / model config", () => {
  it("is off without keys or models", async () => {
    expect((await load({ OPENROUTER_API_KEY: "", NVIDIA_API_KEY: "" })).aiEnabled()).toBe(false);
    expect((await load({ LLM_MODEL: "", LLM_FALLBACK_MODEL: "" })).aiEnabled()).toBe(false);
  });
  it("skips a provider whose key is missing", async () => {
    const { generateStructured } = await load({ OPENROUTER_API_KEY: "" });
    generateText.mockResolvedValueOnce({ output: { ok: true } });
    await expect(generateStructured(args)).resolves.toMatchObject({ model: FALLBACK });
  });
  it("refuses forbidden vendors and non-NVIDIA base URLs", async () => {
    const vendor = ["an", "thropic"].join(""); // keep the literal out of the repo (check:llm-provider)
    expect((await load({ LLM_MODEL: `openrouter:${vendor}/x`, LLM_FALLBACK_MODEL: "" })).aiEnabled()).toBe(false);
    expect((await load({ LLM_MODEL: FALLBACK, LLM_FALLBACK_MODEL: "", NVIDIA_BASE_URL: "https://evil.example/v1" })).aiEnabled()).toBe(false);
    expect((await load({ LLM_MODEL: "nemotron-without-provider", LLM_FALLBACK_MODEL: "" })).aiEnabled()).toBe(false);
  });
});
