import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AiConsentRequiredError } from "@/lib/ai/consent";
import { checkCv } from "@/lib/ai/cv-check";
import { normalizeJobText, type ExtractedJob } from "@/lib/ai/extract-job";
import { extractJob, NothingFoundError } from "@/lib/ai/extract-job.server";
import { QuotaExceededError } from "@/lib/ai/usage";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEMO_READ_ONLY_MESSAGE, isReadOnly } from "@/lib/demo";

export const runtime = "nodejs";
export const maxDuration = 200;

const Body = z.union([
  z.object({ applicationId: z.string().min(1) }),
  // Preview on the new-application form: the posting text of the AI draft + the CV picked in the form.
  z.object({ text: z.string().min(50).max(100_000), resumeId: z.string().min(1) }),
]);
const fail = (error: string, status: number) => Response.json({ error }, { status });
const UNREADABLE_CV = "Teks CV ini tidak terbaca (mungkin hasil scan). Unggah versi PDF yang teksnya bisa disalin.";

/**
 * "Cek CV": skills found / missing + CV tweaks for one posting (lib/ai/cv-check.ts). With an applicationId the
 * result replaces the application's saved one; the new-application preview is returned only, and saved together
 * with the application by createApplication.
 */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("Silakan masuk dulu.", 401);
  if (isReadOnly({ email: session?.user?.email ?? null })) return fail(DEMO_READ_ONLY_MESSAGE, 403);
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail("Permintaan tidak valid.", 400);

  let postingText: string;
  let cvText: string;
  let applicationId: string | null = null;
  if ("applicationId" in body.data) {
    const app = await db.application.findFirst({
      where: { id: body.data.applicationId, userId },
      select: { id: true, jobPostingText: true, resume: { select: { extractedText: true } } },
    });
    if (!app) return fail("Lamaran tidak ditemukan.", 404);
    if (!app.jobPostingText)
      return fail('Lamaran ini belum punya teks lowongan. Buat lamaran lewat "Tambah dengan AI" dulu.', 422);
    if (!app.resume) return fail("Pilih CV yang dikirim di data lamaran dulu.", 422);
    if (!app.resume.extractedText) return fail(UNREADABLE_CV, 422);
    applicationId = app.id;
    postingText = app.jobPostingText;
    cvText = app.resume.extractedText;
  } else {
    const resume = await db.resume.findFirst({
      where: { id: body.data.resumeId, userId },
      select: { extractedText: true },
    });
    if (!resume) return fail("CV tidak ditemukan.", 404);
    if (!resume.extractedText) return fail(UNREADABLE_CV, 422);
    postingText = body.data.text;
    cvText = resume.extractedText;
  }

  // The posting's skills and requirements; a cache hit (no AI, no quota) whenever the text was extracted before.
  let posting: ExtractedJob;
  try {
    ({ job: posting } = await extractJob(normalizeJobText(postingText), userId));
  } catch (error) {
    if (error instanceof AiConsentRequiredError) return fail(error.message, 403);
    if (error instanceof QuotaExceededError) return fail(error.message, 429);
    if (error instanceof NothingFoundError)
      return fail("Tidak ada informasi yang bisa dibaca dari teks lowongan ini.", 422);
    return fail("Isi lowongan belum terbaca dan AI sedang tidak tersedia. Coba lagi nanti.", 503);
  }

  const owner = await db.user.findUnique({ where: { id: userId }, select: { name: true, domicile: true } });
  const result = await checkCv({ posting, cvText, owner: { name: owner?.name, address: owner?.domicile }, userId });

  if (applicationId) {
    await db.$transaction([
      db.skillGap.deleteMany({ where: { applicationId } }),
      db.skillGap.createMany({ data: result.rows.map((r) => ({ ...r, applicationId })) }),
      // Keep earlier tweaks when this run couldn't reach the AI (string match only).
      ...(result.aiNote
        ? []
        : [db.application.update({ where: { id: applicationId }, data: { cvTweaks: result.tweaks } })]),
    ]);
    revalidatePath(`/applications/${applicationId}`);
  }
  return Response.json(result);
}
