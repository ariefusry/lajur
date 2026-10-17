"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEMO_READ_ONLY_MESSAGE, isReadOnly } from "@/lib/demo";
import { applicationSchema, draftSchema, type FormState } from "@/lib/validation";

function parse(formData: FormData) {
  return applicationSchema.safeParse(Object.fromEntries(formData));
}

/** Optional AI draft (requirements + posting text); absent or malformed → ignored, manual flow still works. */
function parseDraft(formData: FormData) {
  const raw = formData.get("draft");
  if (typeof raw !== "string" || !raw) return null;
  try {
    const parsed = draftSchema.safeParse(JSON.parse(raw));
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

  const draft = parseDraft(formData);
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

export async function deleteApplication(id: string) {
  const user = await requireUser();
  if (isReadOnly(user)) return;
  await db.application.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/board");
  redirect("/board");
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
  const req = await db.requirement.findFirst({ where: { id, application: { userId: user.id } }, select: { applicationId: true } });
  if (!req) return;
  await db.requirement.delete({ where: { id } });
  revalidatePath(`/applications/${req.applicationId}`);
  revalidatePath("/board");
}
