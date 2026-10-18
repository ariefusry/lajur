import "server-only";
import { z } from "zod";
import { generateStructured } from "@/lib/ai/provider";
import { rehydrate, type PiiMap } from "@/lib/ai/redact";
import { toDateInput } from "@/lib/dates";

export const FollowUpDraft = z.object({ subject: z.string(), body: z.string() });
export type FollowUpDraft = z.infer<typeof FollowUpDraft>;
export type FollowUpTone = "formal" | "friendly";
export type FollowUpLanguage = "id" | "en";

export type FollowUpApplication = {
  company: string;
  position: string;
  stageName: string;
  appliedAt: Date | null;
  lastFollowUpAt: Date | null;
};

export const FOLLOW_UP_SYSTEM = `Kamu menulis email follow-up lamaran kerja yang singkat dan sopan untuk pencari kerja di Indonesia.
- Tulis dalam bahasa yang diminta: "id" = Bahasa Indonesia, "en" = English.
- Nada "formal": bahasa baku dan sopan. Nada "friendly": hangat tetapi tetap profesional.
- body 80–150 kata: sebut posisi dan tahap terakhir, tanyakan perkembangan proses seleksi, tegaskan minat.
- Tutup body dengan tanda tangan [NAME_1] persis seperti itu.
- Jangan mengarang tanggal, nama perekrut, atau detail lain yang tidak diberikan.`;

export function followUpPrompt(app: FollowUpApplication, tone: FollowUpTone, language: FollowUpLanguage) {
  return [
    `Bahasa: ${language}`,
    `Nada: ${tone}`,
    `Perusahaan: ${app.company}`,
    `Posisi: ${app.position}`,
    `Tahap terakhir: ${app.stageName}`,
    app.appliedAt && `Tanggal melamar: ${toDateInput(app.appliedAt)}`,
    app.lastFollowUpAt && `Follow-up terakhir: ${toDateInput(app.lastFollowUpAt)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Follow-up email draft. Only the application's company/position/stage/dates are sent; the user's name stays on
 * the server and replaces the [NAME_1] signature afterwards. The caller loads `application` filtered by userId.
 */
export async function draftFollowUp({
  application,
  tone,
  language,
  userId,
  ownerName,
}: {
  application: FollowUpApplication;
  tone: FollowUpTone;
  language: FollowUpLanguage;
  userId: string;
  ownerName: string | null;
}): Promise<FollowUpDraft> {
  const { object } = await generateStructured({
    schema: FollowUpDraft,
    system: FOLLOW_UP_SYSTEM,
    prompt: followUpPrompt(application, tone, language),
    feature: "FOLLOW_UP",
    userId,
    maxOutputTokens: 1200,
  });
  const map: PiiMap = ownerName ? { "[NAME_1]": ownerName } : {};
  return { subject: rehydrate(object.subject, map), body: rehydrate(object.body, map) };
}
