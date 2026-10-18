"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { fromDateInput } from "@/lib/dates";
import { db } from "@/lib/db";
import { DEMO_READ_ONLY_MESSAGE, isReadOnly } from "@/lib/demo";
import { FOLLOW_UP_INTERVALS, followUpDate } from "@/lib/follow-up";

const followUpSchema = z.discriminatedUnion("mode", [
  // "Sudah follow-up": record it and remind again in N days.
  z.object({
    mode: z.literal("done"),
    inDays: z.coerce.number().refine((n) => (FOLLOW_UP_INTERVALS as readonly number[]).includes(n)),
  }),
  z.object({ mode: z.literal("schedule"), date: z.iso.date() }),
  z.object({ mode: z.literal("clear") }),
]);

export async function updateFollowUp(id: string, input: unknown): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  if (isReadOnly(user)) return { ok: false, message: DEMO_READ_ONLY_MESSAGE };
  const parsed = followUpSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Tanggal follow-up tidak valid." };
  const app = await db.application.findFirst({ where: { id, userId: user.id }, select: { id: true } });
  if (!app) return { ok: false, message: "Lamaran tidak ditemukan." };

  const now = new Date();
  const v = parsed.data;
  // Any change to the date re-arms the email reminder.
  const data =
    v.mode === "done"
      ? { lastFollowUpAt: now, nextActionAt: followUpDate(now, v.inDays), followUpRemindedAt: null }
      : v.mode === "schedule"
        ? { nextActionAt: fromDateInput(v.date), followUpRemindedAt: null }
        : { nextActionAt: null, followUpRemindedAt: null };
  await db.application.update({ where: { id }, data });

  revalidatePath(`/applications/${id}`);
  revalidatePath("/dashboard");
  const message =
    v.mode === "done"
      ? `Follow-up dicatat. Diingatkan lagi ${v.inDays} hari lagi.`
      : v.mode === "schedule"
        ? "Pengingat follow-up disimpan."
        : "Pengingat follow-up dihapus.";
  return { ok: true, message };
}
