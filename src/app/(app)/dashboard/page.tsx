import Link from "next/link";
import { AddToCalendar } from "@/components/add-to-calendar";
import { Button } from "@/components/ui/button";
import type { JobSource } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth";
import { computeDashboard, weeklyCounts, type PassRate } from "@/lib/dashboard";
import { db } from "@/lib/db";
import { daysUntil, formatDate, formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { EVENT_TYPE_LABELS, JOB_SOURCE_LABELS } from "@/lib/validation";

export const metadata = { title: "Dashboard · Lamarin" };

const RANGES = [
  { key: "30", label: "30 hari", days: 30 },
  { key: "90", label: "90 hari", days: 90 },
  { key: "all", label: "Semua", days: null },
] as const;

const pct = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)}%`);
const DAY_MS = 86_400_000;
/** An active application with no stage change for this long probably needs a follow-up (or closing). */
const STALE_DAYS = 14;
const WEEKS = 12;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const user = await requireUser();
  const { range: rangeParam } = await searchParams;
  const range = RANGES.find((x) => x.key === rangeParam) ?? RANGES[2];
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [stages, allApps, resumes, events, deadlines] = await Promise.all([
    db.stage.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, order: true, kind: true },
    }),
    db.application.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        company: true,
        position: true,
        createdAt: true,
        source: true,
        resumeId: true,
        currentStageId: true,
        appliedAt: true,
        history: { select: { stageId: true, enteredAt: true } },
      },
    }),
    db.resume.findMany({
      where: { userId: user.id },
      select: { id: true, versionName: true },
    }),
    db.event.findMany({
      where: { startsAt: { gte: now }, application: { userId: user.id } },
      orderBy: { startsAt: "asc" },
      take: 6,
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
        deadline: { gte: startOfToday },
        currentStage: { kind: { in: ["WISHLIST", "IN_PROGRESS"] } },
      },
      orderBy: { deadline: "asc" },
      take: 6,
      select: { id: true, company: true, deadline: true },
    }),
  ]);

  // The period filters by application date (falls back to when it was added).
  const since = range.days === null ? null : new Date(now.getTime() - range.days * 86_400_000);
  const apps = since ? allApps.filter((a) => (a.appliedAt ?? a.createdAt) >= since) : allApps;
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
  ]
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, 6);

  if (allApps.length === 0) {
    return (
      <div className="max-w-xl space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <div className="space-y-3 rounded-xl border bg-card p-6">
          <p className="font-medium">Belum ada data untuk dianalisis.</p>
          <p className="text-muted-foreground text-sm">
            Setelah kamu mencatat beberapa lamaran dan menggesernya antar tahap, di sini akan muncul: tahap mana yang
            paling sering membuat gagal, sumber lowongan dan versi CV mana yang paling sering lolos administrasi, dan
            berapa lama perusahaan biasanya merespons.
          </p>
          <Button asChild>
            <Link href="/applications/new">Tambah lamaran pertama</Link>
          </Button>
        </div>
      </div>
    );
  }

  const d = computeDashboard(stages, apps);
  const resumeName = new Map(resumes.map((r) => [r.id, r.versionName]));
  const maxFunnel = Math.max(1, ...d.funnel.map((f) => f.count));
  const maxFailed = Math.max(1, ...d.failedAt.map((f) => f.count));

  // Always the last 12 weeks of all applications (the period filter is for the analysis, not this trend).
  const weekly = weeklyCounts(
    allApps.map((a) => a.appliedAt ?? a.createdAt),
    now,
    WEEKS,
  );
  const maxWeekly = Math.max(1, ...weekly);
  const last4 = weekly.slice(-4).reduce((sum, n) => sum + n, 0);

  const stageById = new Map(stages.map((s) => [s.id, s]));
  const stale = allApps
    .filter((a) => stageById.get(a.currentStageId)?.kind === "IN_PROGRESS")
    .map((a) => {
      const last = Math.max((a.appliedAt ?? a.createdAt).getTime(), ...a.history.map((h) => h.enteredAt.getTime()));
      return { ...a, idleDays: Math.floor((now.getTime() - last) / DAY_MS) };
    })
    .filter((a) => a.idleDays >= STALE_DAYS)
    .sort((a, b) => b.idleDays - a.idleDays);

  const status = [
    { label: "Wishlist", count: d.totals.wishlist, color: "bg-muted-foreground/40" },
    { label: "Berjalan", count: d.totals.active, color: "bg-primary" },
    { label: "Offering", count: d.totals.offers, color: "bg-green-600" },
    { label: "Ditolak / mundur", count: d.totals.rejected, color: "bg-destructive/70" },
  ];

  return (
    <div className="max-w-7xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <nav aria-label="Periode" className="bg-foreground/5 inline-flex rounded-lg p-0.5">
          {RANGES.map((x) => (
            <Link
              key={x.key}
              href={x.key === "all" ? "/dashboard" : `/dashboard?range=${x.key}`}
              aria-current={x.key === range.key ? "true" : undefined}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors pointer-coarse:py-2.5",
                x.key === range.key ? "bg-card font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label}
            </Link>
          ))}
        </nav>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Ringkasan">
        <Stat label="Total lamaran" value={d.totals.applications} href="/board" />
        <Stat label="Masih berjalan" value={d.totals.active} href="/board" />
        <Stat label="Offering" value={d.totals.offers} href="/board" />
        <Stat
          label="Median waktu respons"
          value={d.responseTime.medianDays === null ? "–" : `${Math.round(d.responseTime.medianDays * 10) / 10} hari`}
          note={d.responseTime.sample ? `dari ${d.responseTime.sample} lamaran` : "belum ada perpindahan tahap"}
        />
      </section>

      <section className="space-y-2" aria-label="Status lamaran">
        <div className="bg-muted flex h-3 overflow-hidden rounded-full">
          {status
            .filter((x) => x.count > 0)
            .map((x) => (
              <span
                key={x.label}
                className={cn("h-full", x.color)}
                style={{ width: `${(x.count / Math.max(1, d.totals.applications)) * 100}%` }}
                title={`${x.label}: ${x.count}`}
              />
            ))}
        </div>
        <ul className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {status.map((x) => (
            <li key={x.label} className="flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", x.color)} aria-hidden />
              {x.label} <span className="text-foreground font-medium tabular-nums">{x.count}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="space-y-3">
          <div>
            <h2 className="font-medium">Funnel seleksi</h2>
            <p className="text-muted-foreground text-xs">
              Jumlah lamaran yang pernah mencapai tiap tahap, dan persentase yang lanjut dari tahap sebelumnya.
            </p>
          </div>
          <ol className="space-y-2">
            {d.funnel.map((f) => (
              <li
                key={f.stage}
                className="hover:bg-foreground/5 -mx-2 grid grid-cols-[minmax(6rem,9rem)_1fr_auto] items-center gap-3 rounded-lg px-2 py-1 text-sm transition-colors"
                title={`${f.stage}: ${f.count} lamaran${f.conversion === null ? "" : `, ${pct(f.conversion)} dari tahap sebelumnya`}`}
              >
                <span className="truncate">{f.stage}</span>
                <span className="bg-muted h-5 rounded-sm" aria-hidden>
                  <span
                    className="bg-primary block h-full origin-left rounded-sm motion-safe:animate-[bar-grow_700ms_cubic-bezier(0.2,0.8,0.2,1)_both]"
                    style={{ width: `${(f.count / maxFunnel) * 100}%` }}
                  />
                </span>
                <span className="w-24 text-right tabular-nums">
                  <span className="font-medium">{f.count}</span>
                  {f.conversion !== null && <span className="text-muted-foreground"> · {pct(f.conversion)}</span>}
                </span>
              </li>
            ))}
          </ol>

          <div className="space-y-3 pt-6">
            <div>
              <h2 className="font-medium">Paling sering gagal di</h2>
              <p className="text-muted-foreground text-xs">Tahap terakhir yang dicapai lamaran yang ditolak.</p>
            </div>
            {d.failedAt.length === 0 ? (
              <p className="text-muted-foreground text-sm">Belum ada lamaran yang ditolak pada periode ini.</p>
            ) : (
              <ol className="space-y-2">
                {d.failedAt.map((f) => (
                  <li key={f.stage} className="grid grid-cols-[minmax(6rem,9rem)_1fr_auto] items-center gap-3 text-sm">
                    <span className="truncate">{f.stage}</span>
                    <span className="bg-muted h-2 rounded-full" aria-hidden>
                      <span
                        className="bg-destructive/70 block h-full origin-left rounded-full motion-safe:animate-[bar-grow_700ms_cubic-bezier(0.2,0.8,0.2,1)_both]"
                        style={{ width: `${(f.count / maxFailed) * 100}%` }}
                      />
                    </span>
                    <span className="w-8 text-right font-medium tabular-nums">{f.count}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="space-y-3 pt-6">
            <h2 className="font-medium">Segera tiba</h2>
            {upcoming.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Belum ada jadwal atau deadline mendatang. Tambahkan di halaman detail lamaran.
              </p>
            ) : (
              <ul className="bg-card divide-y overflow-hidden rounded-2xl border shadow-sm">
                {upcoming.map((u) => {
                  const days = daysUntil(u.at);
                  return (
                    <li key={u.key} className="flex items-center pr-2">
                      <Link
                        href={`/applications/${u.appId}`}
                        className="hover:bg-foreground/5 flex min-w-0 flex-1 items-center gap-3 p-3 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{u.title}</p>
                          <p className="text-muted-foreground text-xs">
                            {u.what} · {u.withTime ? formatDateTime(u.at) : formatDate(u.at)}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
                            days <= 3 ? "bg-destructive/10 text-destructive" : "bg-foreground/5 text-muted-foreground",
                          )}
                        >
                          {days <= 0 ? "Hari ini" : `${days} hari lagi`}
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
          </div>
        </section>

        <div className="space-y-8">
          <section className="space-y-3">
            <div>
              <h2 className="font-medium">Aktivitas melamar</h2>
              <p className="text-muted-foreground text-xs">
                Lamaran per minggu, {WEEKS} minggu terakhir · {last4} lamaran dalam 4 minggu terakhir.
              </p>
            </div>
            <div className="flex h-24 items-end gap-1" role="img" aria-label={`Lamaran per minggu: ${weekly.join(", ")}`}>
              {weekly.map((n, i) => (
                <span
                  key={i}
                  className={cn("min-h-1 flex-1 rounded-t-sm", n ? "bg-primary" : "bg-muted")}
                  style={{ height: `${(n / maxWeekly) * 100}%` }}
                  title={`${i === WEEKS - 1 ? "Minggu ini" : `${WEEKS - 1 - i} minggu lalu`}: ${n} lamaran`}
                />
              ))}
            </div>
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>{WEEKS - 1} minggu lalu</span>
              <span>Minggu ini</span>
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="font-medium">Belum ada kabar</h2>
              <p className="text-muted-foreground text-xs">
                Lamaran berjalan tanpa perpindahan tahap selama {STALE_DAYS} hari atau lebih. Saatnya follow-up, atau
                pindahkan ke Ditolak kalau sudah tidak ada harapan.
              </p>
            </div>
            {stale.length === 0 ? (
              <p className="text-muted-foreground text-sm">Semua lamaran yang berjalan masih bergerak.</p>
            ) : (
              <ul className="bg-card divide-y overflow-hidden rounded-2xl border shadow-sm">
                {stale.slice(0, 5).map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/applications/${a.id}`}
                      className="hover:bg-foreground/5 flex items-center gap-3 p-3 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{a.company}</p>
                        <p className="text-muted-foreground truncate text-xs">
                          {stageById.get(a.currentStageId)?.name} · {a.position}
                        </p>
                      </div>
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-amber-700 dark:text-amber-300">
                        {a.idleDays} hari
                      </span>
                    </Link>
                  </li>
                ))}
                {stale.length > 5 && (
                  <li className="text-muted-foreground p-3 text-xs">+{stale.length - 5} lamaran lain</li>
                )}
              </ul>
            )}
          </section>

          <PassTable
            title="Per sumber lowongan"
            empty="Belum ada data."
            adminStage={d.adminStage}
            rows={d.bySource.map((r) => ({
              ...r,
              label: JOB_SOURCE_LABELS[r.key as JobSource],
            }))}
          />
          <PassTable
            title="Per versi CV"
            empty="Belum ada lamaran yang ditautkan ke CV. Pilih CV di form lamaran supaya bisa dibandingkan."
            adminStage={d.adminStage}
            rows={d.byResume.map((r) => ({
              ...r,
              label: resumeName.get(r.key as string) ?? "CV terhapus",
            }))}
          />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, note, href }: { label: string; value: number | string; note?: string; href?: string }) {
  const className = cn(
    "bg-card rounded-2xl border p-4 shadow-sm",
    href && "transition-[box-shadow,transform] hover:shadow-md active:scale-[0.98]",
  );
  const body = (
    <>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {note && <p className="text-muted-foreground text-xs">{note}</p>}
    </>
  );
  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

function PassTable({
  title,
  empty,
  adminStage,
  rows,
}: {
  title: string;
  empty: string;
  adminStage: string | null;
  rows: (PassRate & { label: string })[];
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-medium">{title}</h2>
        <p className="text-muted-foreground text-xs">
          Lolos administrasi = sudah melewati tahap {adminStage ?? "pertama"}, dihitung dari lamaran yang sudah sampai
          tahap itu.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
              <tr>
                <th className="p-2 font-medium">{title.replace("Per ", "").replace(/^./, (c) => c.toUpperCase())}</th>
                <th className="p-2 text-right font-medium">Lamaran</th>
                <th className="p-2 font-medium">Lolos administrasi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.label}>
                  <td className="p-2">{r.label}</td>
                  <td className="p-2 text-right tabular-nums">{r.total}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-2" title={`${r.passedAdmin} dari ${r.reachedAdmin} lolos`}>
                      <span className="bg-muted h-2 w-24 shrink-0 rounded-full" aria-hidden>
                        <span
                          className="bg-primary block h-full rounded-full"
                          style={{ width: `${(r.rate ?? 0) * 100}%` }}
                        />
                      </span>
                      <span className="tabular-nums">
                        {pct(r.rate)}
                        <span className="text-muted-foreground">
                          {" "}
                          ({r.passedAdmin}/{r.reachedAdmin})
                        </span>
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
