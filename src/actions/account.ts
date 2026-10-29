"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { toDateInput, toDateTimeInput } from "@/lib/dates";
import { db } from "@/lib/db";
import { isDemoEmail } from "@/lib/demo";
import { deleteObject } from "@/lib/storage";
import { EVENT_TYPE_LABELS, JOB_SOURCE_LABELS, STAGE_RESULT_LABELS } from "@/lib/validation";

/** The word to type before the account is deleted. */
const CONFIRM_WORD = "HAPUS";

/** All of the user's applications as one CSV (history and schedule folded into a column each). */
export async function exportApplicationsCsv(): Promise<{ filename: string; csv: string }> {
  const user = await requireUser();
  const apps = await db.application.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    include: {
      currentStage: { select: { name: true } },
      resume: { select: { versionName: true } },
      history: { orderBy: { enteredAt: "asc" }, include: { stage: { select: { name: true } } } },
      events: { orderBy: { startsAt: "asc" } },
    },
  });
  // Short columns first and free text last, so the sheet reads without scrolling sideways. Dates are YYYY-MM-DD
  // (Jakarta time), which Excel and Sheets treat as real dates and sort correctly.
  const when = (d: Date) => toDateTimeInput(d).replace("T", " ");
  const now = new Date();
  const csv = toCsv(
    [
      "No",
      "Perusahaan",
      "Posisi",
      "Tahap sekarang",
      "Sumber",
      "Lokasi",
      "Tanggal melamar",
      "Deadline",
      "Gaji diharapkan (Rp/bulan)",
      "CV",
      "Jadwal berikutnya",
      "Follow-up berikutnya",
      "Terakhir follow-up",
      "Dibuat",
      "Riwayat tahap",
      "Semua jadwal",
      "Catatan",
      "Link lowongan",
    ],
    apps.map((a, i) => {
      const next = a.events.find((e) => e.startsAt >= now);
      return [
        i + 1,
        a.company,
        a.position,
        a.currentStage.name,
        JOB_SOURCE_LABELS[a.source],
        a.location,
        toDateInput(a.appliedAt),
        toDateInput(a.deadline),
        a.expectedSalary,
        a.resume?.versionName,
        next ? `${EVENT_TYPE_LABELS[next.type]}, ${when(next.startsAt)}` : "",
        toDateInput(a.nextActionAt),
        toDateInput(a.lastFollowUpAt),
        toDateInput(a.createdAt),
        a.history
          .map(
            (h) =>
              `${toDateInput(h.enteredAt)} ${h.stage.name}${h.result ? ` (${STAGE_RESULT_LABELS[h.result]})` : ""}`,
          )
          .join("; "),
        a.events
          .map((e) => `${EVENT_TYPE_LABELS[e.type]}, ${e.opensAt ? `${when(e.opensAt)} s/d ` : ""}${when(e.startsAt)}`)
          .join("; "),
        a.notes,
        a.url,
      ];
    }),
  );
  return { filename: `lajur-lamaran-${toDateInput(new Date())}.csv`, csv };
}

/**
 * Deletes the account and everything in it: applications (with history, schedule, requirements), CVs (files
 * in storage too), stages, AI usage, sessions. Requires typing the confirm word. Demo accounts can't be deleted.
 */
export async function deleteAccount(confirmation: string): Promise<{ ok: false; message: string }> {
  const user = await requireUser();
  if (isDemoEmail(user.email)) return { ok: false, message: "Akun demo tidak bisa dihapus." };
  if (confirmation.trim() !== CONFIRM_WORD) return { ok: false, message: `Ketik ${CONFIRM_WORD} untuk mengonfirmasi.` };

  const resumes = await db.resume.findMany({ where: { userId: user.id }, select: { filePath: true } });
  for (const r of resumes) {
    // Same rule as deleting one CV: a storage failure is logged, it doesn't block removing the data.
    await deleteObject(r.filePath).catch((error) => console.error("deleteAccount: storage delete failed", { error }));
  }
  await db.$transaction([
    // Applications first: their history rows reference stages, which have no cascade from Stage.
    db.application.deleteMany({ where: { userId: user.id } }),
    db.aiUsage.deleteMany({ where: { userId: user.id } }),
    // Cascades to accounts, sessions, resumes and stages.
    db.user.delete({ where: { id: user.id } }),
  ]);
  console.info("deleteAccount: done", { resumes: resumes.length });

  const jar = await cookies();
  jar.delete("authjs.session-token");
  jar.delete("__Secure-authjs.session-token");
  redirect("/?akun=dihapus");
}
