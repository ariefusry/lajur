import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AiConsentRequiredError } from "@/lib/ai/consent";
import { generateCvProfile } from "@/lib/ai/cv-profile";
import { aiEnabled, AiUnavailableError } from "@/lib/ai/provider";
import { QuotaExceededError } from "@/lib/ai/usage";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEMO_READ_ONLY_MESSAGE, isReadOnly } from "@/lib/demo";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({ resumeId: z.string().min(1) });
const fail = (error: string, status: number) => Response.json({ error }, { status });

/** Search words (roles + skills) from one CV for the "Cari lowongan" links; saved on the resume so the AI runs once. */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("Silakan masuk dulu.", 401);
  if (isReadOnly({ email: session?.user?.email ?? null })) return fail(DEMO_READ_ONLY_MESSAGE, 403);
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail("Permintaan tidak valid.", 400);
  if (!aiEnabled()) return fail("AI tidak aktif. Isi peran yang dicari secara manual.", 503);

  const resume = await db.resume.findFirst({
    where: { id: body.data.resumeId, userId },
    select: { id: true, extractedText: true },
  });
  if (!resume) return fail("CV tidak ditemukan.", 404);
  if (!resume.extractedText)
    return fail("Teks CV ini tidak terbaca (mungkin hasil scan). Unggah versi PDF yang teksnya bisa disalin.", 422);

  const owner = await db.user.findUnique({ where: { id: userId }, select: { name: true, domicile: true } });
  try {
    const profile = await generateCvProfile({
      cvText: resume.extractedText,
      owner: { name: owner?.name, address: owner?.domicile },
      userId,
    });
    if (profile.roles.length === 0)
      return fail("Belum ada peran yang bisa dibaca dari CV ini. Isi manual dulu ya.", 422);
    await db.resume.updateMany({ where: { id: resume.id, userId }, data: { profile } });
    revalidatePath("/jobs");
    return Response.json(profile);
  } catch (error) {
    if (error instanceof AiConsentRequiredError) return fail(error.message, 403);
    if (error instanceof QuotaExceededError) return fail(error.message, 429);
    if (!(error instanceof AiUnavailableError))
      console.error("cv profile failed", error instanceof Error ? error.name : "unknown");
    return fail("AI sedang tidak tersedia, silakan isi manual.", 503);
  }
}
