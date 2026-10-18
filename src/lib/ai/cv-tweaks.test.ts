import { describe, expect, it, vi } from "vitest";

const { generateStructured } = vi.hoisted(() => ({ generateStructured: vi.fn() }));
vi.mock("@/lib/ai/provider", () => ({ generateStructured }));

import { suggestCvTweaks, verifyCvTweaks } from "./cv-tweaks";
import { draftFollowUp } from "./follow-up";

const CV = `Rina Sari
rina@mail.id

PENGALAMAN
Frontend Developer Intern di PT Contoh: membuat dashboard React untuk tim Rina.

KEAHLIAN
React, SQL`;

const posting = {
  company: "PT Bank Contoh", position: "Frontend Engineer", location: null, deadline: null,
  employmentType: null, workMode: null, salaryRange: null, sourceUrl: null, language: "id" as const,
  quotes: { company: null, position: null, location: null, deadline: null },
  skills: [{ name: "TypeScript", quote: "TypeScript" }],
  requirements: [],
};

const tweak = (current: string | null, suggestion = "Tulis hasilnya dengan angka.") => ({ section: "Pengalaman", current, suggestion, reason: "Lowongan minta TypeScript." });

describe("verifyCvTweaks", () => {
  it("drops tweaks whose 'current' text isn't in the CV, keeps additions, caps at 8", () => {
    const cv = "membuat dashboard React";
    const out = verifyCvTweaks({ tweaks: [tweak("membuat dashboard React"), tweak("Memimpin tim 20 orang"), tweak(null), ...Array(10).fill(tweak(null))] }, cv, {});
    expect(out).toHaveLength(8);
    expect(out[0].current).toBe("membuat dashboard React");
    expect(out.some((t) => t.current === "Memimpin tim 20 orang")).toBe(false);
  });
});

describe("suggestCvTweaks", () => {
  it("sends only the redacted CV and puts the name back into the answer", async () => {
    generateStructured.mockResolvedValueOnce({
      object: { tweaks: [tweak("membuat dashboard React untuk tim [NAME_1]", "Ganti [NAME_1] dengan nama tim.")] },
    });
    const out = await suggestCvTweaks({ cvText: CV, posting, userId: "u1", owner: { name: "Rina Sari" } });
    const { prompt, feature } = generateStructured.mock.calls[0][0];
    expect(feature).toBe("CV_TWEAKS");
    expect(prompt).not.toMatch(/rina|@/i);
    expect(prompt).toContain("Skill: TypeScript");
    expect(out[0]).toMatchObject({ current: "membuat dashboard React untuk tim Rina", suggestion: "Ganti Rina dengan nama tim." });
  });
});

describe("draftFollowUp", () => {
  const application = { company: "PT A", position: "Analis Data", stageName: "Interview HR", appliedAt: new Date("2026-10-01T03:00:00Z"), lastFollowUpAt: null };

  it("never sends the user's name, and signs the draft with it afterwards", async () => {
    generateStructured.mockResolvedValueOnce({ object: { subject: "Follow-up lamaran Analis Data", body: "Salam,\n[NAME_1]" } });
    const out = await draftFollowUp({ application, tone: "formal", language: "id", userId: "u1", ownerName: "Rina Sari" });
    const { prompt, feature } = generateStructured.mock.calls.at(-1)![0];
    expect(feature).toBe("FOLLOW_UP");
    expect(prompt).toContain("Bahasa: id");
    expect(prompt).toContain("Tanggal melamar: 2026-10-01");
    expect(prompt).not.toMatch(/rina/i);
    expect(out.body).toBe("Salam,\nRina Sari");
  });
});
