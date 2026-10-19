"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEMO_READ_ONLY_MESSAGE, isReadOnly } from "@/lib/demo";
import { resumeNameSchema } from "@/lib/validation";
import { deleteObject, presignGet } from "@/lib/storage";

/** 60-second presigned URL, only for the owner's resume. */
export async function getResumeUrl(id: string): Promise<{ url?: string; error?: string }> {
  const user = await requireUser();
  const resume = await db.resume.findFirst({ where: { id, userId: user.id }, select: { filePath: true } });
  if (!resume) return { error: "CV tidak ditemukan." };
  return { url: await presignGet(resume.filePath, 60) };
}

export async function renameResume(id: string, name: string): Promise<{ ok: boolean; message?: string }> {
  const user = await requireUser();
  if (isReadOnly(user)) return { ok: false, message: DEMO_READ_ONLY_MESSAGE };
  const parsed = resumeNameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, message: "Isi nama CV (maksimal 100 karakter)." };
  const { count } = await db.resume.updateMany({ where: { id, userId: user.id }, data: { versionName: parsed.data } });
  if (!count) return { ok: false, message: "CV tidak ditemukan." };
  revalidatePath("/resumes");
  revalidatePath("/board");
  revalidatePath("/applications", "layout");
  return { ok: true };
}

export async function deleteResume(id: string) {
  const user = await requireUser();
  if (isReadOnly(user)) return;
  const resume = await db.resume.findFirst({ where: { id, userId: user.id }, select: { filePath: true } });
  if (!resume) return;
  try {
    await deleteObject(resume.filePath);
  } catch (error) {
    // Spec: storage failure must not block removing the row.
    console.error("deleteResume: storage delete failed", { id, error });
  }
  await db.resume.delete({ where: { id } });
  revalidatePath("/resumes");
  revalidatePath("/board");
}
