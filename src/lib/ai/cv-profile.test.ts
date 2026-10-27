import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/provider", () => ({ generateStructured: vi.fn() }));

import { sanitizeProfile } from "./cv-profile";

const CV = "Keahlian\nReact, TypeScript, PostgreSQL\nPengalaman\nMembangun dashboard dengan JS dan Node.js";

describe("sanitizeProfile", () => {
  it("keeps roles as given, trimmed and de-duplicated, at most three", () => {
    const p = sanitizeProfile(
      {
        roles: [" Frontend Developer ", "frontend developer", "Web Developer", "Fullstack Developer", "QA"],
        skills: [],
      },
      CV,
    );
    expect(p.roles).toEqual(["Frontend Developer", "Web Developer", "Fullstack Developer"]);
  });

  it("drops skills the CV does not mention, matching aliases and whole words", () => {
    const p = sanitizeProfile({ roles: ["Web Developer"], skills: ["react", "JavaScript", "Kubernetes", "Java"] }, CV);
    expect(p.skills).toEqual(["react", "JavaScript"]); // "JS" in the CV counts for JavaScript; "Java" is not "JS"
  });

  it("removes placeholders, empty strings and over-long strings", () => {
    const p = sanitizeProfile(
      { roles: ["[NAME_1]", "Data Analyst [EMAIL_1]", "x".repeat(61), "  "], skills: ["[URL_1]"] },
      CV,
    );
    expect(p.roles).toEqual(["Data Analyst"]);
    expect(p.skills).toEqual([]);
  });

  it("caps skills at five", () => {
    const cv = "a1 b2 c3 d4 e5 f6";
    const p = sanitizeProfile({ roles: [], skills: ["a1", "b2", "c3", "d4", "e5", "f6"] }, cv);
    expect(p.skills).toHaveLength(5);
  });
});
