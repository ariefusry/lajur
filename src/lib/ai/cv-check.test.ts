import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateStructured: vi.fn(),
  aiEnabled: vi.fn(() => true),
  AiUnavailableError: class extends Error {},
  QuotaExceededError: class extends Error {},
  AiConsentRequiredError: class extends Error {},
}));
vi.mock("@/lib/ai/provider", () => ({
  generateStructured: mocks.generateStructured,
  aiEnabled: mocks.aiEnabled,
  AiUnavailableError: mocks.AiUnavailableError,
}));
vi.mock("@/lib/ai/usage", () => ({ QuotaExceededError: mocks.QuotaExceededError }));
vi.mock("@/lib/ai/consent", () => ({ AiConsentRequiredError: mocks.AiConsentRequiredError }));

import { checkCv } from "./cv-check";
import type { ExtractedJob } from "./extract-job";

const CV = `Rina Sari
rina@mail.id

PENGALAMAN
Frontend Developer Intern di PT Contoh: membuat dashboard React untuk tim Rina.

KEAHLIAN
React.js, SQL`;

const posting: ExtractedJob = {
  company: "PT Bank Contoh", position: "Frontend Engineer", location: null, deadline: null,
  employmentType: null, workMode: null, salaryRange: null, sourceUrl: null, language: "id",
  quotes: { company: null, position: null, location: null, deadline: null },
  skills: [{ name: "React", quote: "React" }, { name: "TypeScript", quote: "TypeScript" }],
  requirements: [{ type: "MIN_DEGREE", value: "S1", ageReferenceDate: null, quote: "S1" }],
};
const args = { posting, cvText: CV, owner: { name: "Rina Sari" }, userId: "u1" };

beforeEach(() => {
  mocks.generateStructured.mockReset();
  mocks.aiEnabled.mockReturnValue(true);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("checkCv", () => {
  it("matches what it can without AI, sends only the rest plus the redacted CV, and rehydrates the answer", async () => {
    mocks.generateStructured.mockResolvedValueOnce({
      object: {
        skills: [{ skill: "TypeScript", inResume: false, suggestion: "Buat proyek kecil dengan TypeScript.", quote: null }],
        tweaks: [
          { kind: "rewrite", section: "Pengalaman", current: "membuat dashboard React untuk tim [NAME_1]", suggestion: "Membangun dashboard React untuk tim [NAME_1].", reason: "Lowongan minta React." },
          { kind: "rewrite", section: "Keahlian", current: "Memimpin tim 20 orang", suggestion: "x", reason: "dikarang" },
          // Claims the skill the check just found missing:
          { kind: "rewrite", section: "Keahlian", current: "React.js, SQL", suggestion: "React.js, TypeScript, SQL", reason: "dikarang" },
          { kind: "add", section: "Proyek", current: null, suggestion: "Kalau pernah memakai TypeScript, tambahkan proyeknya.", reason: "Lowongan minta TypeScript." },
        ],
      },
    });
    const result = await checkCv(args);

    const { prompt, feature } = mocks.generateStructured.mock.calls[0][0];
    expect(feature).toBe("SKILL_GAP");
    expect(prompt).toMatch(/Skill yang dicek:\n- TypeScript\n\nCV:/); // React was found via the React.js alias
    expect(prompt).toContain("Syarat (MIN_DEGREE): S1");
    expect(prompt).not.toMatch(/rina|sari|@/i);

    expect(result.rows.map((r) => [r.skill, r.inResume])).toEqual([["React", true], ["TypeScript", false]]);
    expect(result).toMatchObject({ matchedWithoutAi: 1, checkedByAi: 1, aiNote: null });
    expect(result.tweaks).toEqual([
      { kind: "rewrite", section: "Pengalaman", current: "membuat dashboard React untuk tim Rina", suggestion: "Membangun dashboard React untuk tim Rina.", reason: "Lowongan minta React." },
      { kind: "add", section: "Proyek", current: null, suggestion: "Kalau pernah memakai TypeScript, tambahkan proyeknya.", reason: "Lowongan minta TypeScript." },
    ]);
  });

  it("still asks for CV tweaks when every skill was already found", async () => {
    mocks.generateStructured.mockResolvedValueOnce({ object: { skills: [], tweaks: [] } });
    await checkCv({ ...args, posting: { ...posting, skills: [{ name: "SQL", quote: "SQL" }] } });
    expect(mocks.generateStructured.mock.calls[0][0].prompt).toContain("(kosong: semua skill sudah ditemukan di CV)");
  });

  it("falls back to the string match with a note when the AI is unavailable or the quota is used up", async () => {
    mocks.generateStructured.mockRejectedValueOnce(new mocks.AiUnavailableError());
    const down = await checkCv(args);
    expect(down.rows.map((r) => r.inResume)).toEqual([true, false]);
    expect(down).toMatchObject({ tweaks: [], checkedByAi: 0, aiNote: expect.stringMatching(/tidak tersedia/) });

    mocks.generateStructured.mockRejectedValueOnce(new mocks.QuotaExceededError("Kuota AI hari ini habis"));
    expect((await checkCv(args)).aiNote).toBe("Kuota AI hari ini habis");
  });

  it("doesn't call the AI at all when it's switched off", async () => {
    mocks.aiEnabled.mockReturnValue(false);
    const result = await checkCv(args);
    expect(mocks.generateStructured).not.toHaveBeenCalled();
    expect(result.aiNote).toMatch(/AI tidak aktif/);
  });
});
