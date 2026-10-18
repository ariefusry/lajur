import { describe, expect, it, vi } from "vitest";

const { generateStructured } = vi.hoisted(() => ({ generateStructured: vi.fn() }));
vi.mock("@/lib/ai/provider", () => ({ generateStructured }));

import { draftFollowUp } from "./follow-up";

describe("draftFollowUp", () => {
  const application = { company: "PT A", position: "Analis Data", stageName: "Interview HR", appliedAt: new Date("2026-10-01T03:00:00Z"), lastFollowUpAt: null };

  it("never sends the user's name, and signs the draft with it afterwards", async () => {
    generateStructured.mockResolvedValueOnce({ object: { subject: "Follow-up lamaran Analis Data", body: "Salam,\n[NAME_1]" } });
    const out = await draftFollowUp({ application, tone: "formal", language: "id", userId: "u1", ownerName: "Rina Sari" });
    const { prompt, feature } = generateStructured.mock.calls[0][0];
    expect(feature).toBe("FOLLOW_UP");
    expect(prompt).toContain("Bahasa: id");
    expect(prompt).toContain("Tanggal melamar: 2026-10-01");
    expect(prompt).not.toMatch(/rina/i);
    expect(out.body).toBe("Salam,\nRina Sari");
  });
});
