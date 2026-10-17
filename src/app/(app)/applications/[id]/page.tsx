import { Trash2 } from "lucide-react";
import { notFound } from "next/navigation";
import { deleteApplication, deleteRequirement, updateApplication } from "@/actions/applications";
import { createEvent, deleteEvent, updateEvent, updateStageHistory } from "@/actions/events";
import { ApplicationForm } from "@/components/application/application-form";
import { DeleteApplicationButton } from "@/components/application/delete-button";
import { EventForm } from "@/components/application/event-form";
import { SkillGapSection } from "@/components/application/skill-gap-section";
import { StageHistoryForm } from "@/components/application/stage-history-form";
import { ViewResumeButton } from "@/components/resumes/resume-actions";
import { EligibilityBadge } from "@/components/eligibility-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isReadOnly } from "@/lib/demo";
import { checkRequirement, overallStatus } from "@/lib/eligibility/check";
import { getEligibilityProfile } from "@/lib/eligibility/profile";
import { formatDate, formatDateTime, toDateInput, toDateTimeInput } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { EVENT_TYPE_LABELS, REQUIREMENT_TYPE_LABELS, STAGE_RESULT_LABELS } from "@/lib/validation";

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [app, stages, resumes, profile] = await Promise.all([
    db.application.findFirst({
      where: { id, userId: user.id },
      include: {
        currentStage: true,
        history: { include: { stage: true }, orderBy: { enteredAt: "asc" } },
        events: { orderBy: { startsAt: "asc" } },
        requirements: true,
        skillGaps: { orderBy: { skill: "asc" } },
        resume: { select: { id: true, versionName: true, extractedText: true } },
      },
    }),
    db.stage.findMany({ where: { userId: user.id }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
    db.resume.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, select: { id: true, versionName: true } }),
    getEligibilityProfile(user.id),
  ]);
  if (!app) notFound();
  const now = new Date();
  const checks = app.requirements.map((r) => ({ ...r, check: checkRequirement(r, profile, now) }));
  const overall = overallStatus(checks.map((c) => c.check.status));

  return (
    <div className="max-w-3xl space-y-10">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">{app.company}</h1>
          <Badge variant="secondary">{app.currentStage.name}</Badge>
          {overall && <EligibilityBadge status={overall} />}
        </div>
        <p className="text-sm text-muted-foreground">{app.position}</p>
        {app.resume && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">CV terkirim:</span> {app.resume.versionName}
            <ViewResumeButton id={app.resume.id} />
          </div>
        )}
      </header>

      {checks.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="font-medium">Syarat & kelayakan</h2>
            <p className="text-xs text-muted-foreground">
              Dicek otomatis dari profil di Pengaturan (tanpa AI). Ubah profil untuk memperbarui hasilnya.
            </p>
          </div>
          <ul className="divide-y rounded-xl border">
            {checks.map((r) => (
              <li key={r.id} className="flex items-start gap-3 p-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{REQUIREMENT_TYPE_LABELS[r.type]}:</span>
                    <span>{r.value}</span>
                    <EligibilityBadge status={r.check.status} />
                  </div>
                  <p className="text-xs">{r.check.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    Bukti: <q className="italic">{r.sourceQuote}</q>
                    {r.editedByUser && " · diubah manual"}
                  </p>
                </div>
                <form action={deleteRequirement.bind(null, r.id)}>
                  <Button type="submit" variant="ghost" size="icon-sm" aria-label={`Hapus syarat ${REQUIREMENT_TYPE_LABELS[r.type]}`}>
                    <Trash2 />
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <SkillGapSection
        applicationId={app.id}
        gaps={app.skillGaps}
        readOnly={isReadOnly(user)}
        blocker={
          !app.jobPostingText
            ? "Analisis skill butuh teks lowongan. Lamaran yang dibuat lewat \"Tempel lowongan\" otomatis menyimpannya."
            : !app.resume
              ? "Pilih CV yang dikirim di bagian Data lamaran di bawah, lalu simpan."
              : !app.resume.extractedText
                ? "Teks CV ini tidak terbaca (mungkin hasil scan). Unggah versi PDF yang teksnya bisa disalin."
                : null
        }
      />

      <section className="space-y-4">
        <h2 className="font-medium">Timeline tahap</h2>
        <ol className="relative space-y-6 border-l pl-6">
          {app.history.map((h) => (
            <li key={h.id} className="relative space-y-2">
              <span
                aria-hidden
                className={cn(
                  "absolute top-1.5 -left-[1.95rem] size-3 rounded-full border-2 border-background",
                  h.result === "PASSED" ? "bg-green-600" : h.result === "FAILED" ? "bg-destructive" : "bg-muted-foreground",
                )}
              />
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-medium">{h.stage.name}</span>
                <span className="text-xs text-muted-foreground">{formatDate(h.enteredAt)}</span>
                {h.result && <Badge variant="outline">{STAGE_RESULT_LABELS[h.result]}</Badge>}
              </div>
              <details>
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  {h.notes ? "Catatan & hasil" : "Tambah catatan"}
                </summary>
                <div className="pt-2">
                  <StageHistoryForm
                    id={h.id}
                    action={updateStageHistory.bind(null, h.id)}
                    defaults={{ result: h.result ?? "", notes: h.notes ?? "" }}
                  />
                </div>
              </details>
              {h.notes && <p className="text-sm whitespace-pre-line text-muted-foreground">{h.notes}</p>}
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-medium">Jadwal</h2>
          <p className="text-xs text-muted-foreground">Pengingat email dikirim H-3 dan H-1 pukul 07.00 WIB.</p>
        </div>
        {app.events.length > 0 && (
          <ul className="divide-y rounded-xl border">
            {app.events.map((e) => (
              <li key={e.id} className={cn("space-y-2 p-3", e.startsAt < now && "opacity-60")}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{EVENT_TYPE_LABELS[e.type]}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(e.startsAt)}
                      {e.locationOrUrl && ` · ${e.locationOrUrl}`}
                    </p>
                  </div>
                  <form action={deleteEvent.bind(null, e.id)}>
                    <Button type="submit" variant="ghost" size="icon-sm" aria-label="Hapus jadwal">
                      <Trash2 />
                    </Button>
                  </form>
                </div>
                <details>
                  <summary className="cursor-pointer text-xs text-muted-foreground">Ubah</summary>
                  <div className="pt-2">
                    <EventForm
                      idPrefix={e.id}
                      action={updateEvent.bind(null, e.id)}
                      submitLabel="Simpan"
                      defaults={{ type: e.type, startsAt: toDateTimeInput(e.startsAt), locationOrUrl: e.locationOrUrl ?? "" }}
                    />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
        <EventForm idPrefix="new-event" action={createEvent.bind(null, app.id)} submitLabel="Tambah jadwal" />
      </section>

      <section className="space-y-4">
        <h2 className="font-medium">Data lamaran</h2>
        <ApplicationForm
          action={updateApplication.bind(null, app.id)}
          stages={stages}
          resumes={resumes}
          submitLabel="Simpan perubahan"
          defaults={{
            company: app.company,
            position: app.position,
            source: app.source,
            currentStageId: app.currentStageId,
            resumeId: app.resumeId ?? "",
            url: app.url ?? "",
            location: app.location ?? "",
            deadline: toDateInput(app.deadline),
            appliedAt: toDateInput(app.appliedAt),
            expectedSalary: app.expectedSalary?.toString() ?? "",
            notes: app.notes ?? "",
          }}
        />
      </section>

      <DeleteApplicationButton action={deleteApplication.bind(null, app.id)} />
    </div>
  );
}
