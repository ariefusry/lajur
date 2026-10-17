"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
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

export async function renameStage(id: string, formData: FormData) {
  const user = await requireUser();
  if (isReadOnly(user)) return;
  const name = stageNameSchema.safeParse(formData.get("name"));
  if (!name.success) return;
  await db.stage.updateMany({ where: { id, userId: user.id }, data: { name: name.data } });
  done();
}

/** Swap with the neighbour above (-1) or below (+1), then renumber 0..n. */
export async function moveStage(id: string, direction: -1 | 1) {
  const user = await requireUser();
  if (isReadOnly(user)) return;
  const stages = await db.stage.findMany({ where: { userId: user.id }, orderBy: { order: "asc" } });
  const i = stages.findIndex((s) => s.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= stages.length) return;
  [stages[i], stages[j]] = [stages[j], stages[i]];
  await db.$transaction(
    stages.map((s, order) => db.stage.update({ where: { id: s.id }, data: { order } })),
  );
  done();
}

export async function applyTemplate(key: TemplateKey): Promise<FormState> {
  const user = await requireUser();
  if (isReadOnly(user)) return { message: DEMO_READ_ONLY_MESSAGE };
  if (!(key in STAGE_TEMPLATES)) return { message: "Template tidak dikenal." };
  // ponytail: only on an empty board; mapping existing applications to new stages can come later if needed.
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
