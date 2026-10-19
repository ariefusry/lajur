import "server-only";
import { generateStructured } from "@/lib/ai/provider";
import { redactPII } from "@/lib/ai/redact";
import {
  EMAIL_SYSTEM,
  EmailReading,
  emailPrompt,
  normalizeEmailText,
  rehydrateReading,
  verifyReading,
} from "./reading";

/**
 * Normalize → redact → LLM (only the redacted text) → drop what the redacted text doesn't back up → put the
 * user's own text back. Throws AiConsentRequiredError, QuotaExceededError or AiUnavailableError.
 */
export async function readEmail(text: string, user: { id: string; name: string | null }) {
  const redacted = redactPII(normalizeEmailText(text), { name: user.name });
  const { object } = await generateStructured({
    schema: EmailReading,
    system: EMAIL_SYSTEM,
    prompt: emailPrompt(redacted.text),
    feature: "EMAIL_UPDATE",
    userId: user.id,
  });
  return { reading: rehydrateReading(verifyReading(object, redacted.text), redacted.map) };
}
