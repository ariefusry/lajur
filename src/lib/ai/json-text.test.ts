import { describe, expect, it } from "vitest";
import { extractJsonObject, jsonStart } from "./json-text";

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

describe("jsonStart", () => {
  it("drops leading prose/fence and a trailing fence while streaming", () => {
    expect(jsonStart('```json\n{"company": "PT A", "posi')).toBe('{"company": "PT A", "posi');
    expect(jsonStart('{"a":1}\n```')).toBe('{"a":1}');
    expect(jsonStart("Sebentar")).toBe("");
  });
});
