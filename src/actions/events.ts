"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { changeStage } from "@/lib/stage-change";
import { DEMO_READ_ONLY_MESSAGE, isReadOnly } from "@/lib/demo";
import { eventSchema, stageHistorySchema, type FormState } from "@/lib/validation";

function done(applicationId: string) {
  revalidatePath(`/applications/${applicationId}`);
  revalidatePath("/calendar");
}

async function ownsApplication(userId: string, applicationId: string) {
  return (await db.application.count({ where: { id: applicationId, userId } })) > 0;
}

export async function createEvent(applicationId: string, _: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (isReadOnly(user)) return { message: DEMO_READ_ONLY_MESSAGE };
  const parsed = eventSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  if (!(await ownsApplication(user.id, applicationId))) return { message: "Lamaran tidak ditemukan." };
  await db.event.create({ data: { ...parsed.data, applicationId } });
  done(applicationId);
  return { ok: true, message: "Jadwal ditambahkan." };
}

export async function updateEvent(id: string, _: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (isReadOnly(user)) return { message: DEMO_READ_ONLY_MESSAGE };
  const parsed = eventSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  const event = await db.event.findFirst({ where: { id, application: { userId: user.id } } });
  if (!event) return { message: "Jadwal tidak ditemukan." };

  const moved = event.startsAt.getTime() !== parsed.data.startsAt.getTime();
  await db.event.update({
    where: { id },
    // A rescheduled event deserves fresh H-3/H-1 reminders.
    data: { ...parsed.data, ...(moved && { remindedH3At: null, remindedH1At: null }) },
  });
  done(event.applicationId);
  return { ok: true, message: "Jadwal diperbarui." };
}

export async function deleteEvent(id: string) {
  const user = await requireUser();
  if (isReadOnly(user)) return;
  const event = await db.event.findFirst({
    where: { id, application: { userId: user.id } },
    select: { applicationId: true },
  });
  if (!event) return;
  await db.event.delete({ where: { id } });
  done(event.applicationId);
}

export async function updateStageHistory(id: string, _: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (isReadOnly(user)) return { message: DEMO_READ_ONLY_MESSAGE };
  const parsed = stageHistorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  const { count } = await db.stageHistory.updateMany({
    where: { id, application: { userId: user.id } },
    data: parsed.data,
  });
  if (!count) return { message: "Riwayat tidak ditemukan." };
  // Failing the stage the card sits in ends the application: move it to the rejection stage.
  let rejected = false;
  if (parsed.data.result === "FAILED") {
    const step = await db.stageHistory.findFirst({
      where: { id },
      select: { applicationId: true, stageId: true, application: { select: { currentStageId: true } } },
    });
    const rejection =
      step?.stageId === step?.application.currentStageId
        ? await db.stage.findFirst({ where: { userId: user.id, kind: "REJECTED" }, orderBy: { order: "asc" } })
        : null;
    if (step && rejection && rejection.id !== step.stageId) {
      await db.$transaction((tx) => changeStage(tx, step.applicationId, user.id, rejection.id));
      rejected = true;
      revalidatePath("/board");
      revalidatePath("/dashboard");
    }
  }
  revalidatePath("/applications/[id]", "page");
  return { ok: true, message: rejected ? "Catatan disimpan. Lamaran dipindah ke Ditolak." : "Catatan disimpan." };
}
