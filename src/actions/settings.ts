"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { StageKind } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEMO_READ_ONLY_MESSAGE, isReadOnly } from "@/lib/demo";
import { STAGE_TEMPLATES, templateStageRows, type TemplateKey } from "@/lib/stage-templates";
import { profileSchema, stageKindSchema, stageNameSchema, type FormState } from "@/lib/validation";

function done() {
  revalidatePath("/settings");
  revalidatePath("/board");
}

export async function updateProfile(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (isReadOnly(user)) return { message: DEMO_READ_ONLY_MESSAGE };
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  await db.user.update({ where: { id: user.id }, data: parsed.data });
  revalidatePath("/settings");
  return { ok: true, message: "Profil disimpan." };
}

/**
 * UU PDP consent for sending text to the (foreign) AI providers; false withdraws it. Returns the new consent
 * time (ISO) or null, which the button shows directly instead of waiting on the page refresh.
 */
export async function setAiConsent(agree: boolean): Promise<{ consentedAt: string | null } | { error: string }> {
  const user = await requireUser();
  if (isReadOnly(user)) return { error: DEMO_READ_ONLY_MESSAGE };
  const parsed = z.boolean().safeParse(agree);
  if (!parsed.success) return { error: "Permintaan tidak valid." };
  const { aiConsentAt } = await db.user.update({
    where: { id: user.id },
    data: { aiConsentAt: parsed.data ? new Date() : null },
    select: { aiConsentAt: true },
  });
  // New users agree to the email wording in the same step; withdrawing and re-agreeing keeps the first notice time.
  if (parsed.data) {
    await db.user.updateMany({ where: { id: user.id, emailAiNoticeAt: null }, data: { emailAiNoticeAt: new Date() } });
  }
  revalidatePath("/settings");
  revalidatePath("/applications/new");
  return { consentedAt: aiConsentAt?.toISOString() ?? null };
}

/** Marks the one-time notice about pasted emails as read. */
export async function acknowledgeEmailNotice(): Promise<{ ok: boolean; message?: string }> {
  const user = await requireUser();
  if (isReadOnly(user)) return { ok: false, message: DEMO_READ_ONLY_MESSAGE };
  await db.user.update({ where: { id: user.id }, data: { emailAiNoticeAt: new Date() } });
  revalidatePath("/settings");
  return { ok: true };
}

export async function addStage(formData: FormData) {
  const user = await requireUser();
  if (isReadOnly(user)) return;
  const name = stageNameSchema.safeParse(formData.get("name"));
  const kind = stageKindSchema.safeParse(formData.get("kind"));
  if (!name.success || !kind.success) return;
  const last = await db.stage.findFirst({ where: { userId: user.id }, orderBy: { order: "desc" } });
  await db.stage.create({
    data: { userId: user.id, name: name.data, kind: kind.data, order: (last?.order ?? -1) + 1 },
  });
  done();
}

/** Autosave from the stage editor: rename and/or change the kind of one stage. */
export async function updateStage(id: string, input: { name?: string; kind?: string }): Promise<FormState> {
  const user = await requireUser();
  if (isReadOnly(user)) return { message: DEMO_READ_ONLY_MESSAGE };
  const data: { name?: string; kind?: StageKind } = {};
  if (input.name !== undefined) {
    const name = stageNameSchema.safeParse(input.name);
    if (!name.success) return { message: "Nama tahap tidak boleh kosong (maks. 50 karakter)." };
    data.name = name.data;
  }
  if (input.kind !== undefined) {
    const kind = stageKindSchema.safeParse(input.kind);
    if (!kind.success) return { message: "Jenis tahap tidak dikenal." };
    data.kind = kind.data;
  }
  await db.stage.updateMany({ where: { id, userId: user.id }, data });
  done();
  return { ok: true, message: "Tahap disimpan." };
}

/** Persist a drag-and-drop order: `ids` must be exactly the user's stages, in the new order. */
export async function reorderStages(ids: string[]): Promise<FormState> {
  const user = await requireUser();
  if (isReadOnly(user)) return { message: DEMO_READ_ONLY_MESSAGE };
  const stages = await db.stage.findMany({ where: { userId: user.id }, select: { id: true } });
  const known = new Set(stages.map((s) => s.id));
  if (ids.length !== known.size || new Set(ids).size !== ids.length || !ids.every((id) => known.has(id))) {
    return { message: "Urutan tahap tidak valid. Muat ulang halaman." };
  }
  await db.$transaction(ids.map((id, order) => db.stage.update({ where: { id }, data: { order } })));
  done();
  return { ok: true, message: "Urutan tahap disimpan." };
}

export async function applyTemplate(key: TemplateKey): Promise<FormState> {
  const user = await requireUser();
  if (isReadOnly(user)) return { message: DEMO_READ_ONLY_MESSAGE };
  if (!(key in STAGE_TEMPLATES)) return { message: "Template tidak dikenal." };
  // Only on an empty board: existing applications would need mapping onto the new stages.
  if (await db.application.count({ where: { userId: user.id } })) {
    return { message: "Template hanya bisa diganti selama belum ada lamaran. Ubah tahap satu per satu di bawah." };
  }
  await db.$transaction([
    db.stage.deleteMany({ where: { userId: user.id } }),
    db.stage.createMany({ data: templateStageRows(key, user.id) }),
  ]);
  done();
  return { ok: true, message: `Template ${STAGE_TEMPLATES[key].label} dipakai.` };
}
