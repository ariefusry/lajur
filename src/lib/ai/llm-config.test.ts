import { describe, expect, it } from "vitest";
import { z } from "zod";
import { modelChain, responseSchema } from "./llm-config";

describe("responseSchema", () => {
  it("drops format/pattern keywords but keeps a property that happens to be called format", () => {
    const s = responseSchema(z.object({ deadline: z.iso.date().nullable(), format: z.string() }));
    expect(JSON.stringify(s)).not.toMatch(/"pattern"|"\$schema"|"date"/);
    expect(s).toMatchObject({
      required: ["deadline", "format"],
      additionalProperties: false,
      properties: { format: { type: "string" } },
    });
  });
});

describe("modelChain", () => {
  const env = {
    LLM_PRIMARY: "groq",
    LLM_FALLBACK: "cloudflare",
    GROQ_API_KEY: "k1",
    GROQ_MODEL: "small",
    GROQ_FALLBACK_MODEL: "big",
    CLOUDFLARE_API_TOKEN: "cf",
    CLOUDFLARE_ACCOUNT_ID: "acc",
    CLOUDFLARE_MODEL: "llama",
  };

  it("tries the second Groq key with every Groq model, after the first key and before the fallback", () => {
    expect(modelChain({ ...env, GROQ_API_KEY_2: "k2" }).map((r) => r.label)).toEqual([
      "groq:small",
      "groq:big",
      "groq-2:small",
      "groq-2:big",
      "cloudflare:llama",
    ]);
  });

  it("keeps the old chain without a second key, or when it repeats the first", () => {
    const old = ["groq:small", "groq:big", "cloudflare:llama"];
    expect(modelChain(env).map((r) => r.label)).toEqual(old);
    expect(modelChain({ ...env, GROQ_API_KEY_2: " k1 " }).map((r) => r.label)).toEqual(old);
  });

  it("still sends Groq's provider options under the groq name for the second key", () => {
    const second = modelChain({ ...env, GROQ_API_KEY_2: "k2" })[2];
    expect(second.provider).toBe("groq");
  });
});
