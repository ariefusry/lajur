import { describe, expect, it } from "vitest";
import { extractJsonObject } from "./json-text";

describe("extractJsonObject", () => {
  it("handles plain JSON, fences and surrounding prose", () => {
    expect(extractJsonObject('{"a":1}')).toBe('{"a":1}');
    expect(extractJsonObject('```json\n{"a":{"b":2}}\n```')).toBe('{"a":{"b":2}}');
    expect(extractJsonObject('Berikut hasilnya:\n{"a":1}\nSemoga membantu.')).toBe('{"a":1}');
  });
  it("returns null without an object", () => {
    expect(extractJsonObject("maaf, tidak bisa")).toBeNull();
    expect(extractJsonObject("{")).toBeNull();
  });
});
