import "server-only";
import { db } from "@/lib/db";

/** UU PDP: text only goes to the (foreign) AI providers after the user agreed to it in Settings. */
export class AiConsentRequiredError extends Error {
  constructor() {
    super("Setujui dulu pemrosesan AI di Pengaturan untuk memakai fitur AI.");
  }
}

export async function hasAiConsent(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { aiConsentAt: true } });
  return !!user?.aiConsentAt;
}

export async function assertAiConsent(userId: string) {
  if (!(await hasAiConsent(userId))) throw new AiConsentRequiredError();
}
