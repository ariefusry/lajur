import { revalidatePath } from "next/cache";
import { z } from "zod";
import { NothingFoundError, postingSkills } from "@/lib/ai/extract-job.server";
import { aiEnabled, AiUnavailableError, generateStructured } from "@/lib/ai/provider";
import { redact } from "@/lib/ai/redact";
import { matchSkills, SKILL_GAP_SYSTEM, SkillGapAnswer, skillGapPrompt, verifySkillGap, type GapRow } from "@/lib/ai/skill-gap";
import { QuotaExceededError } from "@/lib/ai/usage";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEMO_READ_ONLY_MESSAGE, isReadOnly } from "@/lib/demo";

export const runtime = "nodejs";
export const maxDuration = 200;

const Body = z.object({ applicationId: z.string().min(1) });
const fail = (error: string, status: number) => Response.json({ error }, { status });

/**
 * Skill gap for one application (CLAUDE.md 7.5): string/alias match first, then only the remaining skills
 * plus the *redacted* CV go to the LLM. Without AI the string-match result is still saved.
 */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("Silakan masuk dulu.", 401);
  if (isReadOnly({ email: session?.user?.email ?? null })) return fail(DEMO_READ_ONLY_MESSAGE, 403);
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail("Permintaan tidak valid.", 400);

  const app = await db.application.findFirst({
    where: { id: body.data.applicationId, userId },
    select: { id: true, jobPostingText: true, resume: { select: { extractedText: true } } },
  });
  if (!app) return fail("Lamaran tidak ditemukan.", 404);
  if (!app.jobPostingText) return fail("Lamaran ini belum punya teks lowongan. Buat lamaran lewat \"Tempel lowongan\" dulu.", 422);
  if (!app.resume) return fail("Pilih CV yang dikirim di data lamaran dulu.", 422);
  if (!app.resume.extractedText) return fail("Teks CV ini tidak terbaca (mungkin hasil scan). Unggah versi PDF yang teksnya bisa disalin.", 422);
  const cvText = app.resume.extractedText;

  let skills: string[];
  try {
    skills = await postingSkills(app.jobPostingText, userId);
  } catch (error) {
    if (error instanceof QuotaExceededError) return fail(error.message, 429);
    if (error instanceof NothingFoundError) return fail("Tidak ada skill yang bisa dibaca dari teks lowongan ini.", 422);
    return fail("Daftar skill lowongan belum tersedia dan AI sedang tidak tersedia. Coba lagi nanti.", 503);
  }
  if (!skills.length) return fail("Lowongan ini tidak menyebut skill teknis.", 422);

  // 1. No AI: aliases/verbatim matches.
  const { found, missing } = matchSkills(skills, cvText);

  // 2–3. Only what's left, and only the redacted CV, goes to the LLM.
  let fromAi: GapRow[] = [];
  let aiNote: string | null = null;
  if (missing.length) {
    const redacted = redact(cvText, session?.user?.name ?? null);
    const notChecked = (suggestion: string) => missing.map((skill) => ({ skill, inResume: false, suggestion, sourceQuote: null }));
    if (!aiEnabled()) {
      fromAi = notChecked("Tidak ditemukan di CV. AI tidak aktif, jadi istilah setara belum dicek.");
    } else {
      try {
        const { object } = await generateStructured({
          schema: SkillGapAnswer,
          system: SKILL_GAP_SYSTEM,
          prompt: skillGapPrompt(missing, redacted),
          feature: "SKILL_GAP",
          userId,
        });
        fromAi = verifySkillGap(missing, object, redacted);
      } catch (error) {
        aiNote = error instanceof QuotaExceededError ? error.message : "AI sedang tidak tersedia, jadi hanya pencocokan teks yang dipakai.";
        if (!(error instanceof QuotaExceededError || error instanceof AiUnavailableError)) {
          console.error("skill gap failed", error instanceof Error ? error.name : "unknown");
        }
        fromAi = notChecked("Tidak ditemukan di CV. Istilah setara belum dicek AI.");
      }
    }
  }

  const rows = [...found, ...fromAi];
  await db.$transaction([
    db.skillGap.deleteMany({ where: { applicationId: app.id } }),
    db.skillGap.createMany({ data: rows.map((r) => ({ ...r, applicationId: app.id })) }),
  ]);
  revalidatePath(`/applications/${app.id}`);
  return Response.json({ rows, matchedWithoutAi: found.length, checkedByAi: aiNote ? 0 : fromAi.length, aiNote });
}
