import { ArrowLeft, CalendarClock, ExternalLink, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { deleteRequirement, updateApplication } from "@/actions/applications";
import { createEvent, deleteEvent, updateEvent, updateStageHistory } from "@/actions/events";
import { AddToCalendar } from "@/components/add-to-calendar";
import { ApplicationForm } from "@/components/application/application-form";
import { DeleteApplicationButton } from "@/components/application/delete-button";
import { EventForm } from "@/components/application/event-form";
import { FollowUpPanel } from "@/components/application/follow-up-panel";
import { CvCheckSection } from "@/components/application/cv-check-section";
import { readCvTweaks } from "@/lib/ai/cv-tweaks";
import { StageHistoryForm } from "@/components/application/stage-history-form";
import { Card } from "@/components/dashboard/cards";
import { EligibilityBadge } from "@/components/eligibility-badge";
import { ViewResumeButton } from "@/components/resumes/resume-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ButtonGroup, { buttonGroupItemClass } from "@/components/ui/primitive-button-group";
import { requireUser } from "@/lib/auth";
import { appFactsFor, GHOSTED_DAYS } from "@/lib/dashboard";
import { daysUntil, formatDate, formatDateTime, toDateInput, toDateTimeInput } from "@/lib/dates";
import { db } from "@/lib/db";
import { isReadOnly } from "@/lib/demo";
import { checkRequirement, overallStatus } from "@/lib/eligibility/check";
import { getEligibilityProfile } from "@/lib/eligibility/profile";
import { isFollowUpDue } from "@/lib/follow-up";
import { cn } from "@/lib/utils";
import { EVENT_TYPE_LABELS, JOB_SOURCE_LABELS, REQUIREMENT_TYPE_LABELS, STAGE_RESULT_LABELS } from "@/lib/validation";

const TABS = [
  { key: "ringkasan", label: "Ringkasan" },
  { key: "riwayat", label: "Riwayat tahap" },
  { key: "jadwal", label: "Jadwal" },
  { key: "skill", label: "Cek CV" },
  { key: "data", label: "Ubah data" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

/**
 * One application, in the order people ask about it: where is it (header + stage progress), what's next
 * (Ringkasan), then the details, each on its own tab. Read first; editing lives in "Ubah data".
 */
export default async function ApplicationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const tabParam = (await searchParams).tab;
  const tab: TabKey = TABS.some((t) => t.key === tabParam) ? (tabParam as TabKey) : "ringkasan";
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
    db.stage.findMany({
      where: { userId: user.id },
      orderBy: { order: "asc" },
      select: { id: true, name: true, order: true, kind: true },
    }),
    db.resume.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, versionName: true },
    }),
    getEligibilityProfile(user.id),
  ]);
  if (!app) notFound();
  const now = new Date();
  const checks = app.requirements.map((r) => ({ ...r, check: checkRequirement(r, profile, now) }));
  const overall = overallStatus(checks.map((c) => c.check.status));
  const facts = appFactsFor(stages, now)(app);
  const readOnly = isReadOnly(user);
  const base = `/applications/${app.id}`;
  const tabHref = (key: TabKey) => (key === "ringkasan" ? base : `${base}?tab=${key}`);
  const upcomingEvents = app.events.filter((e) => e.startsAt >= now);

  // Progress: the open stages in order, marked done / current / ahead; a closing stage (Ditolak) is shown at the end.
  const reached = new Set(app.history.map((h) => h.stageId));
  const closed = app.currentStage.kind === "REJECTED" || app.currentStage.kind === "WITHDRAWN";
  const steps = stages.filter((s) => s.kind !== "REJECTED" && s.kind !== "WITHDRAWN");
  const currentIndex = steps.findIndex((s) => s.id === app.currentStageId);

  return (
    <div className="max-w-6xl space-y-5">
      <header className="space-y-3">
        <Link href="/applications" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
          <ArrowLeft className="size-4" aria-hidden /> Semua lamaran
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{app.company}</h1>
            <p className="text-muted-foreground">{app.position}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {facts.ghosted && (
              <Badge
                variant="secondary"
                className="bg-amber-500/15 text-amber-700 dark:text-amber-300"
                title={`Tanpa kabar ${GHOSTED_DAYS} hari atau lebih`}
              >
                Ghosted
              </Badge>
            )}
            {overall && <EligibilityBadge status={overall} />}
          </div>
        </div>

        {/* Phone: the current stage and how far along, as one line + a segmented bar. */}
        <div className="space-y-1.5 sm:hidden">
          <p className="text-sm">
            <span className={cn("font-semibold", closed ? "text-destructive" : "text-primary")}>{app.currentStage.name}</span>
            {!closed && currentIndex >= 0 && (
              <span className="text-muted-foreground">
                {" "}
                · tahap {currentIndex + 1} dari {steps.length}
              </span>
            )}
          </p>
          <div className="flex gap-1" aria-hidden>
            {steps.map((s, i) => (
              <span
                key={s.id}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  i === currentIndex ? "bg-primary" : reached.has(s.id) ? "bg-primary/40" : "bg-muted",
                )}
              />
            ))}
          </div>
        </div>

        {/* Desktop: every open stage, done ✓, the current one highlighted. */}
        <ol aria-label="Progres tahap" className="-mx-1 hidden items-center gap-1 overflow-x-auto px-1 pb-1 sm:flex">
          {steps.map((s, i) => {
            const current = s.id === app.currentStageId;
            const done = !current && reached.has(s.id);
            return (
              <li key={s.id} className="flex shrink-0 items-center gap-1">
                {i > 0 && <span aria-hidden className={cn("h-px w-3", done || current ? "bg-primary/50" : "bg-border")} />}
                <span
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-xs whitespace-nowrap",
                    current && "border-primary bg-primary text-primary-foreground font-medium",
                    done && "border-primary/30 text-primary",
                    !current && !done && "text-muted-foreground",
                  )}
                >
                  {done && "✓ "}
                  {s.name}
                </span>
              </li>
            );
          })}
          {closed && (
            <li className="flex shrink-0 items-center gap-1">
              <span aria-hidden className="bg-destructive/50 h-px w-3" />
              <span aria-current="step" className="bg-destructive/10 text-destructive border-destructive/30 rounded-lg border px-2.5 py-1 text-xs font-medium">
                {app.currentStage.name}
              </span>
            </li>
          )}
        </ol>
      </header>

      <ButtonGroup role="navigation" aria-label="Bagian lamaran" className="max-w-full overflow-x-auto p-1">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={tabHref(t.key)}
            scroll={false}
            aria-current={t.key === tab ? "page" : undefined}
            className={buttonGroupItemClass(t.key === tab, "shrink-0")}
          >
            {t.label}
            {t.key === "jadwal" && upcomingEvents.length > 0 && (
              <span className="bg-primary/15 text-primary rounded-full px-1.5 text-[11px] tabular-nums">{upcomingEvents.length}</span>
            )}
          </Link>
        ))}
      </ButtonGroup>

      {tab === "ringkasan" && (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-4">
            <Card title="Langkah berikutnya" description="Jadwal terdekat dan deadline lamaran ini.">
              <NextStep app={app} upcoming={upcomingEvents} now={now} jadwalHref={tabHref("jadwal")} />
            </Card>

            <Card
              title="Syarat & kelayakan"
              description="Dicek otomatis dari profil di Pengaturan (tanpa AI). Ubah profil untuk memperbarui hasilnya."
            >
              {checks.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Belum ada syarat tercatat. Lamaran yang dibuat lewat &ldquo;Tambah dengan AI&rdquo; otomatis membaca syarat
                  seperti IPK, usia, dan jurusan dari lowongan.
                </p>
              ) : (
                <ul className="-mx-5 -mb-5 divide-y border-t">
                  {checks.map((r) => (
                    <li key={r.id} className="flex items-start gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-medium">{REQUIREMENT_TYPE_LABELS[r.type]}:</span>
                          <span>{r.value}</span>
                          <EligibilityBadge status={r.check.status} />
                        </div>
                        <p className="text-xs">{r.check.reason}</p>
                        <p className="text-muted-foreground text-xs">
                          Bukti: <q className="italic">{r.sourceQuote}</q>
                          {r.editedByUser && " · diubah manual"}
                        </p>
                      </div>
                      {!readOnly && (
                        <form action={deleteRequirement.bind(null, r.id)}>
                          <Button type="submit" variant="ghost" size="icon-sm" aria-label={`Hapus syarat ${REQUIREMENT_TYPE_LABELS[r.type]}`}>
                            <Trash2 />
                          </Button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {app.notes && (
              <Card
                title="Catatan"
                action={
                  <Link href={tabHref("data")} className="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline">
                    <Pencil className="size-3.5" aria-hidden /> Ubah
                  </Link>
                }
              >
                <p className="text-sm whitespace-pre-line">{app.notes}</p>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <FollowUpPanel
              id={app.id}
              next={toDateInput(app.nextActionAt)}
              nextLabel={app.nextActionAt ? formatDate(app.nextActionAt) : null}
              lastLabel={app.lastFollowUpAt ? formatDate(app.lastFollowUpAt) : null}
              due={isFollowUpDue(app.nextActionAt, now)}
            />
            <Card
              title="Info lamaran"
              action={
                <Link href={tabHref("data")} className="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline">
                  <Pencil className="size-3.5" aria-hidden /> Ubah
                </Link>
              }
            >
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <Fact label="Sumber">{JOB_SOURCE_LABELS[app.source]}</Fact>
                <Fact label="Lokasi">{app.location}</Fact>
                <Fact label="Melamar">{app.appliedAt && formatDate(app.appliedAt)}</Fact>
                <Fact label="Deadline">{app.deadline && formatDate(app.deadline)}</Fact>
                <Fact label="Gaji diharapkan">
                  {app.expectedSalary && `Rp${app.expectedSalary.toLocaleString("id-ID")}/bulan`}
                </Fact>
                <Fact label="CV dikirim">
                  {app.resume && (
                    <span className="inline-flex flex-wrap items-center gap-2">
                      {app.resume.versionName} <ViewResumeButton id={app.resume.id} />
                    </span>
                  )}
                </Fact>
                <Fact label="Lowongan">
                  {app.url && (
                    <a href={app.url} target="_blank" rel="noopener noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline">
                      Buka link <ExternalLink className="size-3.5" aria-hidden />
                    </a>
                  )}
                </Fact>
              </dl>
            </Card>
          </div>
        </div>
      )}

      {tab === "riwayat" && (
        <Card title="Riwayat tahap" description="Setiap perpindahan tahap, dengan hasil dan catatan (pertanyaan wawancara, kesan, alasan gagal).">
          <ol className="relative space-y-6 border-l pl-6">
            {app.history.map((h) => (
              <li key={h.id} className="relative space-y-2">
                <span
                  aria-hidden
                  className={cn(
                    "border-background absolute top-1.5 -left-[1.95rem] size-3 rounded-full border-2",
                    h.result === "PASSED" ? "bg-green-600" : h.result === "FAILED" ? "bg-destructive" : "bg-muted-foreground",
                  )}
                />
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-medium">{h.stage.name}</span>
                  <span className="text-muted-foreground text-xs">{formatDate(h.enteredAt)}</span>
                  {h.result && <Badge variant="outline">{STAGE_RESULT_LABELS[h.result]}</Badge>}
                </div>
                {h.notes && <p className="text-muted-foreground text-sm whitespace-pre-line">{h.notes}</p>}
                {!readOnly && (
                  <details>
                    <summary className="text-primary cursor-pointer text-xs font-medium">
                      {h.notes || h.result ? "Ubah hasil & catatan" : "Tambah hasil & catatan"}
                    </summary>
                    <div className="pt-2">
                      <StageHistoryForm
                        id={h.id}
                        action={updateStageHistory.bind(null, h.id)}
                        defaults={{ result: h.result ?? "", notes: h.notes ?? "" }}
                      />
                    </div>
                  </details>
                )}
              </li>
            ))}
          </ol>
        </Card>
      )}

      {tab === "jadwal" && (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Card title="Jadwal" description="Tes, interview, MCU. Pengingat email dikirim H-3 dan H-1 pukul 07.00 WIB.">
            {app.events.length === 0 ? (
              <p className="text-muted-foreground text-sm">Belum ada jadwal. Tambahkan di samping.</p>
            ) : (
              <ul className="-mx-5 -mb-5 divide-y border-t">
                {app.events.map((e) => (
                  <li key={e.id} className={cn("space-y-2 px-5 py-3", e.startsAt < now && "opacity-60")}>
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{EVENT_TYPE_LABELS[e.type]}</p>
                        <p className="text-muted-foreground text-xs">
                          {formatDateTime(e.startsAt)}
                          {e.locationOrUrl && ` · ${e.locationOrUrl}`}
                        </p>
                      </div>
                      <AddToCalendar
                        title={`${EVENT_TYPE_LABELS[e.type]} · ${app.company}`}
                        start={e.startsAt}
                        details={app.position}
                        location={e.locationOrUrl}
                      />
                      {!readOnly && (
                        <form action={deleteEvent.bind(null, e.id)}>
                          <Button type="submit" variant="ghost" size="icon-sm" aria-label="Hapus jadwal">
                            <Trash2 />
                          </Button>
                        </form>
                      )}
                    </div>
                    {!readOnly && (
                      <details>
                        <summary className="text-primary cursor-pointer text-xs font-medium">Ubah</summary>
                        <div className="pt-2">
                          <EventForm
                            idPrefix={e.id}
                            action={updateEvent.bind(null, e.id)}
                            submitLabel="Simpan"
                            defaults={{ type: e.type, startsAt: toDateTimeInput(e.startsAt), locationOrUrl: e.locationOrUrl ?? "" }}
                          />
                        </div>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {!readOnly && (
            <Card title="Tambah jadwal">
              <EventForm idPrefix="new-event" action={createEvent.bind(null, app.id)} submitLabel="Tambah jadwal" />
            </Card>
          )}
        </div>
      )}

      {tab === "skill" && (
        <div className="glass rounded-2xl border p-5">
          <CvCheckSection
            applicationId={app.id}
            gaps={app.skillGaps}
            tweaks={readCvTweaks(app.cvTweaks)}
            readOnly={readOnly}
            blocker={
              !app.jobPostingText
                ? 'Cek CV butuh teks lowongan. Lamaran yang dibuat lewat "Tambah dengan AI" otomatis menyimpannya.'
                : !app.resume
                  ? 'Pilih CV yang dikirim di tab "Ubah data", lalu simpan.'
                  : !app.resume.extractedText
                    ? "Teks CV ini tidak terbaca (mungkin hasil scan). Unggah versi PDF yang teksnya bisa disalin."
                    : null
            }
          />
        </div>
      )}

      {tab === "data" && (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Card title="Data lamaran" description="Perusahaan, tahap, CV, tanggal, dan catatan.">
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
          </Card>
          <Card title="Hapus lamaran" description="Beserta riwayat, jadwal, dan syaratnya. Masih bisa diurungkan sesaat setelah dihapus.">
            <DeleteApplicationButton id={app.id} />
          </Card>
        </div>
      )}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children || <span className="text-muted-foreground">–</span>}</dd>
    </>
  );
}

type NextStepApp = { deadline: Date | null; company: string; position: string };

/** The soonest scheduled event, plus the registration deadline while it's still ahead. */
function NextStep({
  app,
  upcoming,
  now,
  jadwalHref,
}: {
  app: NextStepApp;
  upcoming: { id: string; type: keyof typeof EVENT_TYPE_LABELS; startsAt: Date; locationOrUrl: string | null }[];
  now: Date;
  jadwalHref: string;
}) {
  const next = upcoming[0];
  const deadlineDays = app.deadline ? daysUntil(app.deadline, now) : null;
  return (
    <div className="space-y-3">
      {next ? (
        <div className="flex items-center gap-3">
          <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
            <CalendarClock className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">{EVENT_TYPE_LABELS[next.type]}</p>
            <p className="text-muted-foreground text-sm">
              {formatDateTime(next.startsAt)}
              {next.locationOrUrl && ` · ${next.locationOrUrl}`}
            </p>
          </div>
          <AddToCalendar title={`${EVENT_TYPE_LABELS[next.type]} · ${app.company}`} start={next.startsAt} details={app.position} location={next.locationOrUrl} />
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          Belum ada jadwal tes atau interview.{" "}
          <Link href={jadwalHref} scroll={false} className="text-primary font-medium hover:underline">
            Tambah jadwal
          </Link>
        </p>
      )}
      {deadlineDays !== null && deadlineDays >= 0 && (
        <p className={cn("text-sm", deadlineDays <= 3 ? "text-destructive font-medium" : "text-muted-foreground")}>
          Deadline pendaftaran {formatDate(app.deadline!)} ·{" "}
          {deadlineDays === 0 ? "hari ini" : deadlineDays === 1 ? "besok" : `${deadlineDays} hari lagi`}
        </p>
      )}
      {upcoming.length > 1 && (
        <Link href={jadwalHref} scroll={false} className="text-primary text-sm font-medium hover:underline">
          +{upcoming.length - 1} jadwal lain
        </Link>
      )}
    </div>
  );
}
