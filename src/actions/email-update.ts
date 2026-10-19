"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { EventType } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEMO_READ_ONLY_MESSAGE, isReadOnly } from "@/lib/demo";
import { appendNotes, planHistoryWrites, type Change } from "@/lib/email-update/plan";
import { changeStage } from "@/lib/stage-change";
import { applicationSchema } from "@/lib/validation";

const key = z.string().min(1);
const instant = z.iso.datetime({ offset: true });

const changeSchema = z.discriminatedUnion("kind", [
  z.object({ id: key, kind: z.literal("move"), stageId: key, quote: z.string() }),
  z
    .object({
      id: key,
      kind: z.literal("event"),
      type: z.enum(EventType),
      startsAt: instant,
      opensAt: instant.nullable(),
      locationOrUrl: z.string().trim().max(500).nullable(),
      quote: z.string(),
    })
    .refine((e) => !e.opensAt || Date.parse(e.opensAt) < Date.parse(e.startsAt)),
  z.object({ id: key, kind: z.literal("fail"), stageId: key, quote: z.string() }),
  z.object({ id: key, kind: z.literal("notes"), text: z.string().trim().min(1).max(10_000) }),
]) satisfies z.ZodType<Change>;

const inputSchema = z
  .object({
    applicationId: key.nullable(),
    newApplication: applicationSchema
      .pick({ company: true, position: true, source: true })
      .extend({
        url: z
          .url({ protocol: /^https?$/ })
          .max(2000)
          .nullable(),
      })
      .nullable(),
    changes: z.array(changeSchema).max(20),
  })
  .refine((i) => (i.applicationId === null) !== (i.newApplication === null));

export type ApplyEmailUpdateInput = z.input<typeof inputSchema>;

/** Applies the changes the user reviewed for a pasted email, all or nothing. No AI call here. */
export async function applyEmailUpdate(
  input: ApplyEmailUpdateInput,
): Promise<{ ok: true; applicationId: string } | { ok: false; message: string }> {
  const user = await requireUser();
  if (isReadOnly(user)) return { ok: false, message: DEMO_READ_ONLY_MESSAGE };
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Data perubahan tidak valid." };
  const { applicationId, newApplication, changes } = parsed.data;

  const stageIds = [...new Set(changes.flatMap((c) => (c.kind === "move" || c.kind === "fail" ? [c.stageId] : [])))];
  if ((await db.stage.count({ where: { id: { in: stageIds }, userId: user.id } })) !== stageIds.length) {
    return { ok: false, message: "Tahap seleksinya sudah berubah. Baca ulang emailnya." };
  }
  if (applicationId && !(await db.application.count({ where: { id: applicationId, userId: user.id } }))) {
    return { ok: false, message: "Lamaran tidak ditemukan." };
  }
  const startStage = newApplication
    ? ((await db.stage.findFirst({
        where: { userId: user.id, kind: "WISHLIST" },
        orderBy: { order: "asc" },
        select: { id: true },
      })) ??
      (await db.stage.findFirst({ where: { userId: user.id }, orderBy: { order: "asc" }, select: { id: true } })))
    : null;
  if (newApplication && !startStage) return { ok: false, message: "Atur tahap seleksi di Pengaturan dulu." };

  const stages = await db.stage.findMany({ where: { userId: user.id }, select: { id: true, order: true, kind: true } });

  let id: string;
  try {
    id = await db.$transaction(async (tx) => {
      const now = new Date();
      const app = applicationId
        ? await tx.application.findFirstOrThrow({
            where: { id: applicationId, userId: user.id },
            select: {
              id: true,
              currentStageId: true,
              history: { orderBy: [{ enteredAt: "asc" }, { id: "asc" }], select: { stageId: true, enteredAt: true } },
            },
          })
        : await tx.application.create({
            data: {
              ...newApplication!,
              userId: user.id,
              currentStageId: startStage!.id,
              history: { create: { stageId: startStage!.id, enteredAt: now } },
            },
            select: { id: true, currentStageId: true, history: { select: { stageId: true, enteredAt: true } } },
          });
      const appId = app.id;
      const lastStep = (stageId?: string) =>
        tx.stageHistory.findFirst({
          where: { applicationId: appId, ...(stageId && { stageId }) },
          orderBy: [{ enteredAt: "desc" }, { id: "desc" }],
          select: { id: true, notes: true },
        });

      for (const w of planHistoryWrites(app, stages, changes, now)) {
        if (w.op === "move") {
          await changeStage(tx, appId, user.id, w.stageId, w.enteredAt);
        } else if (w.op === "addFailed") {
          await tx.stageHistory.create({
            data: { applicationId: appId, stageId: w.stageId, enteredAt: w.enteredAt, result: "FAILED" },
          });
        } else {
          const step = await lastStep(w.stageId);
          if (step) await tx.stageHistory.update({ where: { id: step.id }, data: { result: "FAILED" } });
        }
      }
      for (const c of changes) {
        if (c.kind !== "event") continue;
        await tx.event.create({
          data: {
            applicationId: appId,
            type: c.type,
            startsAt: new Date(c.startsAt),
            opensAt: c.opensAt ? new Date(c.opensAt) : null,
            locationOrUrl: c.locationOrUrl || null,
          },
        });
      }
      for (const c of changes) {
        if (c.kind !== "notes") continue;
        const step = await lastStep();
        if (step) {
          await tx.stageHistory.update({
            where: { id: step.id },
            data: { notes: appendNotes(step.notes, c.text, new Date()) },
          });
        }
      }
      return appId;
    });
  } catch (error) {
    // Prisma errors can echo the query arguments (notes, credentials), so only the error kind is logged.
    console.error("applyEmailUpdate failed", {
      applicationId,
      error: error instanceof Error ? error.name : typeof error,
      code: (error as { code?: unknown })?.code,
    });
    return { ok: false, message: "Gagal menerapkan perubahan. Coba lagi." };
  }

  revalidatePath("/board");
  revalidatePath(`/applications/${id}`);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  return { ok: true, applicationId: id };
}
