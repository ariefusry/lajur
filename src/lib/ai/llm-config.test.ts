import { describe, expect, it } from "vitest";
import { z } from "zod";
import { responseSchema } from "./llm-config";

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
