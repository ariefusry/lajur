import { z } from "zod";
import { AiConsentRequiredError } from "@/lib/ai/consent";
import { AiUnavailableError } from "@/lib/ai/provider";
import { QuotaExceededError } from "@/lib/ai/usage";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEMO_READ_ONLY_MESSAGE, isReadOnly } from "@/lib/demo";
import { matchApplications, planEmailUpdate } from "@/lib/email-update/plan";
import { readEmail } from "@/lib/email-update/read.server";
import type { EmailReading } from "@/lib/email-update/reading";

export const runtime = "nodejs";
export const maxDuration = 200; // per model: first try + retry (≤30 s each), up to 3 models

const Body = z.object({ text: z.string().trim().min(30).max(100_000) });
const fail = (error: string, status: number) => Response.json({ error }, { status });

/**
 * "Update dari email": reads a pasted recruitment email with AI and proposes changes for the matching application.
 * Nothing is saved here; the full reading is returned so the client can re-plan for another candidate.
 */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("Silakan masuk dulu.", 401);
  if (isReadOnly({ email: session?.user?.email ?? null })) return fail(DEMO_READ_ONLY_MESSAGE, 403);
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail("Tempel isi email dari perusahaan (minimal 30 karakter).", 400);

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, aiConsentAt: true, emailAiNoticeAt: true },
  });
  if (!user?.aiConsentAt) return fail(new AiConsentRequiredError().message, 403);
  if (!user.emailAiNoticeAt) return fail('Baca pemberitahuan soal isi email dulu, lalu tekan "Saya mengerti".', 409);

  let reading: EmailReading;
  try {
    ({ reading } = await readEmail(body.data.text, { id: userId, name: user.name }));
  } catch (error) {
    if (error instanceof AiConsentRequiredError) return fail(error.message, 403);
    if (error instanceof QuotaExceededError) return fail(error.message, 429);
    if (!(error instanceof AiUnavailableError))
      console.error("ai email-update failed", error instanceof Error ? error.name : "unknown");
    return fail("AI sedang tidak tersedia, silakan isi manual.", 503);
  }
  if (reading.kind === "OTHER" && reading.events.length === 0 && reading.notes.length === 0)
    return fail("Tidak ada info seleksi yang bisa dicatat dari email ini.", 422);

  const [apps, stages] = await Promise.all([
    db.application.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        company: true,
        position: true,
        currentStageId: true,
        // Oldest first: planning reads the last step as the one the rejection is about.
        history: { orderBy: [{ enteredAt: "asc" }, { id: "asc" }], select: { stageId: true, result: true } },
        events: { select: { type: true, startsAt: true, opensAt: true } },
      },
    }),
    db.stage.findMany({
      where: { userId },
      orderBy: { order: "asc" },
      select: { id: true, name: true, order: true, kind: true },
    }),
  ]);

  // Matches first (best first), then the rest, most recently updated first (sort is stable).
  const matches = matchApplications(reading.company, apps);
  const rank = (id: string) => (matches.includes(id) ? matches.indexOf(id) : matches.length);
  const sorted = [...apps].sort((a, b) => rank(a.id) - rank(b.id));
  const matchedId = matches[0] ?? null;
  const changes = planEmailUpdate(reading, { stages, app: sorted.find((a) => a.id === matchedId) ?? null });

  return Response.json({
    reading,
    candidates: sorted.map((a) => ({
      ...a,
      events: a.events.map((e) => ({
        type: e.type,
        startsAt: e.startsAt.toISOString(),
        opensAt: e.opensAt?.toISOString() ?? null,
      })),
    })),
    stages,
    matchedId,
    changes,
  });
}
