import { ArrowRight, BarChart3, Sparkles } from "lucide-react";
import Link from "next/link";
import { AddToCalendar } from "@/components/add-to-calendar";
import { Card, Stat, pct } from "@/components/dashboard/cards";
import { Button } from "@/components/ui/button";
import { ShinyButton } from "@/components/ui/shiny-button";
import { requireUser } from "@/lib/auth";
import {
  appFactsFor,
  computeDashboard,
  GHOSTED_DAYS,
  MIN_SAMPLE,
  QUIET_DAYS,
  rate,
  weeklyCounts,
} from "@/lib/dashboard";
import { db } from "@/lib/db";
import { isFollowUpDue } from "@/lib/follow-up";
import { daysUntil, formatDate, formatDateTime, fromDateInput, toDateInput } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { EVENT_TYPE_LABELS } from "@/lib/validation";

export const metadata = { title: "Dashboard · Lajur" };

const DAY_MS = 86_400_000;
/** Follow-ups only make sense while the application is still open. */
const isOpen = (kind: string | undefined) => kind === "WISHLIST" || kind === "IN_PROGRESS" || kind === "OFFER";
const WEEKS = 12;
const AHEAD_DAYS = 7;

/** "3 dari 40", plus why there's no percentage yet when the sample is small. */
const outOf = (count: number, of: number, what = "lamaran") =>
  `${count} dari ${of} ${what}${of > 0 && of < MIN_SAMPLE ? ` · % muncul dari ${MIN_SAMPLE} lamaran` : ""}`;

const ago = (date: Date, now: Date) => {
  const days = -daysUntil(date, now);
  return days <= 0 ? "hari ini" : days === 1 ? "kemarin" : `${days} hari lalu`;
};

/** Dashboard = "what do I do today". Strategy questions live on /analytics. */
export default async function DashboardPage() {
  const user = await requireUser();
  const now = new Date();
  const startOfToday = fromDateInput(toDateInput(now)); // Jakarta midnight
  const horizon = new Date(startOfToday.getTime() + (AHEAD_DAYS + 1) * DAY_MS);
  const [stages, apps, events, deadlines, activity] = await Promise.all([
    db.stage.findMany({
      where: { userId: user.id },
      orderBy: { order: "asc" },
      select: { id: true, name: true, order: true, kind: true },
    }),
    db.application.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        company: true,
        position: true,
        source: true,
        resumeId: true,
        currentStageId: true,
        appliedAt: true,
        nextActionAt: true,
        history: { select: { stageId: true, enteredAt: true } },
      },
    }),
    db.event.findMany({
      where: { startsAt: { gte: now, lt: horizon }, application: { userId: user.id } },
      orderBy: { startsAt: "asc" },
      select: {
        id: true,
        type: true,
        startsAt: true,
        locationOrUrl: true,
        application: { select: { id: true, company: true } },
      },
    }),
    db.application.findMany({
      where: {
        userId: user.id,
        deadline: { gte: startOfToday, lt: horizon },
        currentStage: { kind: { in: ["WISHLIST", "IN_PROGRESS"] } },
      },
      orderBy: { deadline: "asc" },
      select: { id: true, company: true, deadline: true },
    }),
    db.stageHistory.findMany({
      where: { application: { userId: user.id } },
      orderBy: { enteredAt: "desc" },
      take: 8,
      select: {
        id: true,
        enteredAt: true,
        stage: { select: { name: true, kind: true } },
        application: { select: { id: true, company: true } },
      },
    }),
  ]);

  if (apps.length === 0) {
    return (
      <div className="max-w-xl space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <div className="glass space-y-3 rounded-2xl border p-6">
          <p className="font-medium">Belum ada lamaran.</p>
          <p className="text-muted-foreground text-sm">
            Tempel teks lowongan dan AI mengisi form-nya untukmu, atau isi manual. Setelah itu, di sini muncul jadwal
            tes dan interview terdekat, deadline yang hampir tutup, dan lamaran yang sudah lama tanpa kabar.
          </p>
          <ShinyButton href="/applications/new">
            <Sparkles /> Tambah dengan AI
          </ShinyButton>
        </div>
      </div>
    );
  }

  const d = computeDashboard(stages, apps, now);
  const facts = apps.map(appFactsFor(stages, now));
  const withFacts = apps.map((a, i) => ({ ...a, ...facts[i] }));
  const stageById = new Map(stages.map((s) => [s.id, s]));

  const appliedDates = facts.flatMap((f) => (f.appliedOn ? [f.appliedOn] : []));
  const daysBack = (n: number) => now.getTime() - n * DAY_MS;
  const thisWeek = appliedDates.filter((t) => t.getTime() > daysBack(7)).length;
  const lastWeek = appliedDates.filter((t) => t.getTime() > daysBack(14) && t.getTime() <= daysBack(7)).length;
  const weekly = weeklyCounts(appliedDates, now, WEEKS);
  const maxWeekly = Math.max(1, ...weekly);

  const o = d.outcomes;
  const activeLive = d.totals.active - d.totals.ghosted;

  const upcoming = [
    ...events.map((e) => ({
      key: `e${e.id}`,
      appId: e.application.id,
      title: e.application.company,
      what: EVENT_TYPE_LABELS[e.type],
      at: e.startsAt,
      withTime: true,
      location: e.locationOrUrl,
    })),
    ...deadlines.map((a) => ({
      key: `d${a.id}`,
      appId: a.id,
      title: a.company,
      what: "Deadline pendaftaran",
      at: a.deadline!,
      withTime: false,
      location: null,
    })),
    // Follow-ups scheduled for the coming days (due ones are in the follow-up card instead).
    ...withFacts
      .filter(
        (a) => isOpen(a.kind) && a.nextActionAt && !isFollowUpDue(a.nextActionAt, now) && a.nextActionAt < horizon,
      )
      .map((a) => ({
        key: `f${a.id}`,
        appId: a.id,
        title: a.company,
        what: "Follow-up",
        at: a.nextActionAt!,
        withTime: false,
        location: null,
      })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  // Follow-up card: due/overdue follow-ups first, then quiet applications with nothing scheduled yet.
  const dueFollowUps = withFacts
    .filter((a) => isOpen(a.kind) && isFollowUpDue(a.nextActionAt, now))
    .sort((a, b) => a.nextActionAt!.getTime() - b.nextActionAt!.getTime());
  const quiet = withFacts.filter((a) => a.quiet && !a.nextActionAt).sort((a, b) => b.idleDays - a.idleDays);
  const followUps = [
    ...dueFollowUps.map((a) => {
      const late = -daysUntil(a.nextActionAt!, now);
      return { ...a, note: late === 0 ? "Hari ini" : `Lewat ${late} hari`, urgent: true };
    }),
    ...quiet.map((a) => ({ ...a, note: `${a.idleDays} hari tanpa kabar`, urgent: false })),
  ];

  // Where everything is right now; ghosted ones are pulled out of their stage into their own row.
  const pipeline = [
    ...stages.map((s) => ({
      key: s.id,
      label: s.name,
      count: withFacts.filter((a) => a.currentStageId === s.id && !a.ghosted).length,
      href: `/applications?stage=${s.id}`,
      color:
        s.kind === "WISHLIST"
          ? "bg-muted-foreground/40"
          : s.kind === "OFFER"
            ? "bg-green-600"
            : s.kind === "REJECTED" || s.kind === "WITHDRAWN"
              ? "bg-destructive/70"
              : "bg-primary",
    })),
    {
      key: "ghosted",
      label: "Ghosted",
      count: d.totals.ghosted,
      href: "/applications?stage=ghosted",
      color: "bg-amber-500",
    },
  ];
  const maxPipeline = Math.max(1, ...pipeline.map((p) => p.count));

  return (
    <div className="max-w-7xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="hidden md:inline-flex">
            <Link href="/analytics">
              <BarChart3 /> Analytics
            </Link>
          </Button>
          <ShinyButton href="/applications/new" size="sm">
            <Sparkles /> Tambah dengan AI
          </ShinyButton>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Ringkasan">
        <Stat
          label="Lamaran minggu ini"
          value={thisWeek}
          note={`minggu lalu: ${lastWeek}`}
          href="/applications?sort=applied"
        />
        <Stat
          label="Response rate"
          value={pct(rate(o.responded, o.applied))}
          note={outOf(o.responded, o.applied)}
          href="/analytics"
        />
        <Stat
          label="Interview rate"
          value={pct(rate(o.interviewed, o.applied))}
          note={outOf(o.interviewed, o.applied)}
          href="/analytics"
        />
        <Stat
          label="Menunggu respons"
          value={o.waiting}
          note={`dari ${activeLive} lamaran aktif`}
          href="/applications?sort=applied"
        />
      </section>

      {/* What needs attention: dates coming up, and applications going quiet before they turn ghosted. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title={`${AHEAD_DAYS} hari ke depan`}
          description="Tes, interview, MCU, dan deadline yang hampir tutup."
          action={
            <Link href="/calendar" className="text-primary text-sm font-medium hover:underline">
              Kalender
            </Link>
          }
        >
          {upcoming.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Tidak ada jadwal atau deadline dalam {AHEAD_DAYS} hari ke depan.
            </p>
          ) : (
            <ul className="-mx-5 -mb-5 divide-y border-t">
              {upcoming.map((u) => {
                const days = daysUntil(u.at);
                return (
                  <li key={u.key} className="flex items-center pr-3">
                    <Link
                      href={`/applications/${u.appId}`}
                      className="hover:bg-foreground/5 flex min-w-0 flex-1 items-center gap-3 py-3 pl-5 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{u.title}</p>
                        <p className="text-muted-foreground truncate text-xs">
                          {u.what} · {u.withTime ? formatDateTime(u.at) : formatDate(u.at)}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
                          days <= 2 ? "bg-destructive/10 text-destructive" : "bg-foreground/5 text-muted-foreground",
                        )}
                      >
                        {days <= 0 ? "Hari ini" : days === 1 ? "Besok" : `${days} hari lagi`}
                      </span>
                    </Link>
                    <AddToCalendar
                      title={`${u.what} · ${u.title}`}
                      start={u.at}
                      allDay={!u.withTime}
                      location={u.location}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card
          title="Perlu follow-up"
          description={`Follow-up yang jatuh tempo, dan lamaran ${QUIET_DAYS}–${GHOSTED_DAYS - 1} hari tanpa kabar (jadi ghosted di ${GHOSTED_DAYS} hari).`}
          action={
            followUps.length > 0 && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 tabular-nums dark:text-amber-300">
                {followUps.length}
              </span>
            )
          }
        >
          {followUps.length === 0 ? (
            <p className="text-muted-foreground text-sm">Tidak ada yang perlu di-follow-up hari ini.</p>
          ) : (
            <ul className="-mx-5 divide-y border-y">
              {followUps.slice(0, 5).map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/applications/${a.id}`}
                    className="hover:bg-foreground/5 flex items-center gap-3 px-5 py-3 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.company}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {stageById.get(a.currentStageId)?.name} · {a.position}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "text-xs font-medium whitespace-nowrap tabular-nums",
                        a.urgent ? "text-destructive" : "text-amber-700 dark:text-amber-300",
                      )}
                    >
                      {a.note}
                    </span>
                  </Link>
                </li>
              ))}
              {followUps.length > 5 && (
                <li className="text-muted-foreground px-5 py-3 text-xs">+{followUps.length - 5} lamaran lain</li>
              )}
            </ul>
          )}
          {d.totals.ghosted > 0 && (
            <Link
              href="/applications?stage=ghosted"
              className="text-muted-foreground hover:text-foreground mt-auto inline-flex items-center gap-1 text-xs"
            >
              {d.totals.ghosted} lamaran sudah ghosted (tanpa kabar {GHOSTED_DAYS}+ hari)
              <ArrowRight className="size-3" />
            </Link>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <Card
          title="Pipeline"
          description="Posisi semua lamaran saat ini. Klik untuk melihat daftarnya."
          className="lg:col-span-2"
        >
          <ul className="space-y-1">
            {pipeline.map((p) => (
              <li key={p.key}>
                <Link
                  href={p.href}
                  className="hover:bg-foreground/5 -mx-2 grid grid-cols-[minmax(6rem,9rem)_1fr_2rem] items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors"
                >
                  <span className="truncate">{p.label}</span>
                  <span className="bg-muted h-2.5 rounded-full" aria-hidden>
                    <span
                      className={cn(
                        "block h-full origin-left rounded-full motion-safe:animate-[bar-grow_700ms_cubic-bezier(0.2,0.8,0.2,1)_both]",
                        p.color,
                      )}
                      style={{ width: `${(p.count / maxPipeline) * 100}%` }}
                    />
                  </span>
                  <span className={cn("text-right font-medium tabular-nums", p.count === 0 && "text-muted-foreground")}>
                    {p.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <div className="flex flex-col gap-4">
          <Card title="Lamaran per minggu" description={`${WEEKS} minggu terakhir, menurut tanggal melamar.`}>
            <div
              className="flex h-24 items-end gap-1"
              role="img"
              aria-label={`Lamaran per minggu: ${weekly.join(", ")}`}
            >
              {weekly.map((n, i) => (
                <span
                  key={i}
                  className={cn("min-h-1 flex-1 rounded-t-sm", n ? "bg-primary" : "bg-muted")}
                  style={{ height: `${(n / maxWeekly) * 100}%` }}
                  title={`${i === WEEKS - 1 ? "Minggu ini" : `${WEEKS - 1 - i} minggu lalu`}: ${n} lamaran`}
                />
              ))}
            </div>
            <div className="text-muted-foreground -mt-2 flex justify-between text-xs">
              <span>{WEEKS} minggu lalu</span>
              <span>Minggu ini</span>
            </div>
          </Card>

          <Card title="Aktivitas terbaru" description="Perubahan tahap terakhir.">
            <ul className="-mx-5 -mb-5 divide-y border-t">
              {activity.map((h) => (
                <li key={h.id}>
                  <Link
                    href={`/applications/${h.application.id}`}
                    className="hover:bg-foreground/5 flex items-center gap-3 px-5 py-2.5 transition-colors"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        h.stage.kind === "OFFER"
                          ? "bg-green-600"
                          : h.stage.kind === "REJECTED" || h.stage.kind === "WITHDRAWN"
                            ? "bg-destructive"
                            : h.stage.kind === "WISHLIST"
                              ? "bg-muted-foreground/50"
                              : "bg-primary",
                      )}
                    />
                    <p className="min-w-0 flex-1 truncate text-sm">
                      <span className="font-medium">{h.application.company}</span>
                      <span className="text-muted-foreground"> → {h.stage.name}</span>
                    </p>
                    <span className="text-muted-foreground text-xs whitespace-nowrap">{ago(h.enteredAt, now)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
