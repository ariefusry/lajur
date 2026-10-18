"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { readCvTweaks } from "@/lib/ai/cv-tweaks";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEMO_READ_ONLY_MESSAGE, isReadOnly } from "@/lib/demo";
import { applicationSnapshotSchema, type ApplicationSnapshot } from "@/lib/application-snapshot";
import { applicationSchema, cvCheckSchema, draftSchema, type FormState } from "@/lib/validation";

function parse(formData: FormData) {
  return applicationSchema.safeParse(Object.fromEntries(formData));
}

/** Optional hidden JSON field (AI draft, CV check); absent or malformed → ignored, manual flow still works. */
function parseJsonField<T>(formData: FormData, name: string, schema: z.ZodType<T>): T | null {
  const raw = formData.get(name);
  if (typeof raw !== "string" || !raw) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function ownsStage(userId: string, stageId: string) {
  return (await db.stage.count({ where: { id: stageId, userId } })) > 0;
}

async function ownsResume(userId: string, resumeId: string | null) {
  return resumeId === null || (await db.resume.count({ where: { id: resumeId, userId } })) > 0;
}

export async function createApplication(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (isReadOnly(user)) return { message: DEMO_READ_ONLY_MESSAGE };
  const parsed = parse(formData);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  if (!(await ownsStage(user.id, parsed.data.currentStageId))) return { message: "Tahap tidak valid." };
  if (!(await ownsResume(user.id, parsed.data.resumeId))) return { message: "CV tidak valid." };

  const draft = parseJsonField(formData, "draft", draftSchema);
  // A "Cek CV" result only belongs to the application if it was made for the CV that is being sent.
  const cvCheck = parseJsonField(formData, "cvCheck", cvCheckSchema);
  const check = cvCheck && cvCheck.resumeId === parsed.data.resumeId ? cvCheck : null;
  await db.application.create({
    data: {
      ...parsed.data,
      userId: user.id,
      jobPostingText: draft?.jobPostingText ?? null,
      history: { create: { stageId: parsed.data.currentStageId } },
      requirements: {
        create: (draft?.requirements ?? []).map((r) => ({
          ...r,
          ageReferenceDate: r.ageReferenceDate ? new Date(`${r.ageReferenceDate}T00:00:00Z`) : null,
        })),
      },
      ...(check && { skillGaps: { create: check.rows }, cvTweaks: check.tweaks }),
    },
  });
  revalidatePath("/board");
  redirect("/board");
}

export async function updateApplication(id: string, _: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (isReadOnly(user)) return { message: DEMO_READ_ONLY_MESSAGE };
  const parsed = parse(formData);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };

  const existing = await db.application.findFirst({ where: { id, userId: user.id }, select: { currentStageId: true } });
  if (!existing) return { message: "Lamaran tidak ditemukan." };
  if (!(await ownsStage(user.id, parsed.data.currentStageId))) return { message: "Tahap tidak valid." };
  if (!(await ownsResume(user.id, parsed.data.resumeId))) return { message: "CV tidak valid." };

  const stageChanged = existing.currentStageId !== parsed.data.currentStageId;
  await db.application.update({
    where: { id },
    data: {
      ...parsed.data,
      ...(stageChanged && { history: { create: { stageId: parsed.data.currentStageId } } }),
    },
  });
  revalidatePath("/board");
  revalidatePath(`/applications/${id}`);
  return { ok: true, message: "Perubahan disimpan." };
}

/** Deletes the application and returns a snapshot so the UI can offer "Urungkan" (see restoreApplication). */
export async function deleteApplication(
  id: string,
): Promise<{ ok: true; snapshot: ApplicationSnapshot } | { ok: false; message: string }> {
  const user = await requireUser();
  if (isReadOnly(user)) return { ok: false, message: DEMO_READ_ONLY_MESSAGE };
  const app = await db.application.findFirst({
    where: { id, userId: user.id },
    include: { history: true, events: true, requirements: true, skillGaps: true },
  });
  if (!app) return { ok: false, message: "Lamaran tidak ditemukan." };
  await db.application.delete({ where: { id: app.id } });
  revalidatePath("/board");
  return {
    ok: true,
    snapshot: {
      ...app,
      cvTweaks: readCvTweaks(app.cvTweaks),
      history: app.history.map(({ stageId, enteredAt, result, notes }) => ({ stageId, enteredAt, result, notes })),
      events: app.events.map(({ type, startsAt, locationOrUrl, remindedH3At, remindedH1At }) => ({
        type,
        startsAt,
        locationOrUrl,
        remindedH3At,
        remindedH1At,
      })),
      requirements: app.requirements.map(({ type, value, sourceQuote, status, reason, editedByUser }) => ({
        type,
        value,
        sourceQuote,
        status,
        reason,
        editedByUser,
      })),
      skillGaps: app.skillGaps.map(({ skill, inResume, suggestion, sourceQuote }) => ({
        skill,
        inResume,
        suggestion,
        sourceQuote,
      })),
    },
  };
}

/** "Urungkan": recreate a just-deleted application (same id) from its snapshot, for the logged-in user only. */
export async function restoreApplication(input: unknown): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  if (isReadOnly(user)) return { ok: false, message: DEMO_READ_ONLY_MESSAGE };
  const parsed = applicationSnapshotSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Data pemulihan tidak valid." };
  const { history, events, requirements, skillGaps, resumeId, ...app } = parsed.data;

  const stageIds = [...new Set([app.currentStageId, ...history.map((h) => h.stageId)])];
  if ((await db.stage.count({ where: { id: { in: stageIds }, userId: user.id } })) !== stageIds.length) {
    return { ok: false, message: "Tahap seleksinya sudah berubah, lamaran tidak bisa dipulihkan." };
  }
  // The CV may have been deleted in the meantime: restore without the link rather than fail.
  const resumeStillThere = resumeId ? (await db.resume.count({ where: { id: resumeId, userId: user.id } })) > 0 : false;

  try {
    await db.application.create({
      data: {
        ...app,
        userId: user.id,
        resumeId: resumeStillThere ? resumeId : null,
        history: { create: history },
        events: { create: events },
        requirements: { create: requirements },
        skillGaps: { create: skillGaps },
      },
    });
  } catch {
    return { ok: false, message: "Gagal memulihkan lamaran (mungkin sudah dipulihkan)." };
  }
  revalidatePath("/board");
  return { ok: true, message: "Lamaran dipulihkan." };
}

/** Kanban drop: move to another stage and record history atomically. */
export async function moveApplication(id: string, stageId: string): Promise<{ ok: boolean; message?: string }> {
  const user = await requireUser();
  if (isReadOnly(user)) return { ok: false, message: DEMO_READ_ONLY_MESSAGE };
  try {
    await db.$transaction(async (tx) => {
      const [app, stage] = await Promise.all([
        tx.application.findFirst({ where: { id, userId: user.id }, select: { currentStageId: true } }),
        tx.stage.findFirst({ where: { id: stageId, userId: user.id }, select: { id: true } }),
      ]);
      if (!app || !stage) throw new Error("not found");
      if (app.currentStageId === stageId) return;
      const history = await tx.stageHistory.findMany({
        where: { applicationId: id },
        orderBy: { enteredAt: "asc" },
        select: { id: true, stageId: true, notes: true },
      });
      // Dragged back to a stage it already went through = a correction (or back-and-forth): drop the steps after
      // it instead of logging the same stages again. Steps with notes are kept, so nothing written is lost.
      const back = history.findLastIndex((h) => h.stageId === stageId);
      const later = back === -1 ? [] : history.slice(back + 1);
      if (back !== -1 && later.every((h) => !h.notes?.trim())) {
        await tx.stageHistory.deleteMany({ where: { id: { in: later.map((h) => h.id) } } });
        await tx.application.update({ where: { id }, data: { currentStageId: stageId } });
        return;
      }
      await tx.application.update({
        where: { id },
        data: { currentStageId: stageId, history: { create: { stageId } } },
      });
    });
  } catch (error) {
    console.error("moveApplication failed", { id, stageId, error });
    return { ok: false };
  }
  revalidatePath("/board");
  return { ok: true };
}

export async function deleteRequirement(id: string) {
  const user = await requireUser();
  if (isReadOnly(user)) return;
  const req = await db.requirement.findFirst({
    where: { id, application: { userId: user.id } },
    select: { applicationId: true },
  });
  if (!req) return;
  await db.requirement.delete({ where: { id } });
  revalidatePath(`/applications/${req.applicationId}`);
  revalidatePath("/board");
}
