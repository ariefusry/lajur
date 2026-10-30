import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AiConsentRequiredError } from "@/lib/ai/consent";
import { interviewKindFor, readInterviewPrep } from "@/lib/ai/interview-prep";
import { generateInterviewPrep } from "@/lib/ai/interview-prep.server";
import { aiEnabled, AiUnavailableError } from "@/lib/ai/provider";
import { QuotaExceededError } from "@/lib/ai/usage";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEMO_READ_ONLY_MESSAGE, isReadOnly } from "@/lib/demo";

export const runtime = "nodejs";
export const maxDuration = 200;

const Body = z.object({ applicationId: z.string().min(1) });
const fail = (error: string, status: number) => Response.json({ error }, { status });

/**
 * "Persiapan interview": questions and answer outlines for one application at its current stage
 * (lib/ai/interview-prep.server.ts), saved on the application per stage. One AI call, one quota use.
 */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("Silakan masuk dulu.", 401);
  if (isReadOnly({ email: session?.user?.email ?? null })) return fail(DEMO_READ_ONLY_MESSAGE, 403);
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail("Permintaan tidak valid.", 400);
  if (!aiEnabled()) return fail("AI tidak aktif, jadi persiapan interview belum bisa dibuat.", 503);

  const app = await db.application.findFirst({
    where: { id: body.data.applicationId, userId },
    select: {
      id: true,
      company: true,
      position: true,
      jobPostingText: true,
      expectedSalary: true,
      interviewPrep: true,
      currentStage: { select: { id: true, name: true, kind: true } },
      requirements: { where: { type: { in: ["PLACEMENT", "SERVICE_BOND"] } }, select: { type: true, value: true } },
      resume: { select: { extractedText: true } },
    },
  });
  if (!app) return fail("Lamaran tidak ditemukan.", 404);
  const kind = interviewKindFor(app.currentStage);
  if (!kind) return fail(`Tahap "${app.currentStage.name}" bukan interview, jadi tidak ada yang disiapkan.`, 422);

  const owner = await db.user.findUnique({ where: { id: userId }, select: { name: true, domicile: true } });
  let prep;
  try {
    prep = await generateInterviewPrep({
      company: app.company,
      position: app.position,
      postingText: app.jobPostingText,
      expectedSalary: app.expectedSalary,
      requirements: app.requirements,
      stageName: app.currentStage.name,
      kind,
      cvText: app.resume?.extractedText ?? null,
      owner: { name: owner?.name, address: owner?.domicile },
      userId,
    });
  } catch (error) {
    if (error instanceof AiConsentRequiredError) return fail(error.message, 403);
    if (error instanceof QuotaExceededError) return fail(error.message, 429);
    if (!(error instanceof AiUnavailableError))
      console.error("interview prep failed", error instanceof Error ? error.name : "unknown");
    return fail("AI sedang tidak tersedia. Coba lagi nanti.", 503);
  }
  if (prep.questions.length === 0) return fail("AI belum menghasilkan pertanyaan yang valid. Coba buat ulang.", 502);

  // Other stages' preparations stay; this stage's is replaced.
  await db.application.updateMany({
    where: { id: app.id, userId },
    data: { interviewPrep: { ...readInterviewPrep(app.interviewPrep), [app.currentStage.id]: prep } },
  });
  revalidatePath(`/applications/${app.id}`);
  return Response.json({ stageId: app.currentStage.id, prep });
}
