import Link from "next/link";
import { Card, Stat, pct } from "@/components/dashboard/cards";
import { Button } from "@/components/ui/button";
import ButtonGroup, { buttonGroupItemClass } from "@/components/ui/primitive-button-group";
import type { JobSource } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth";
import { appFactsFor, computeDashboard, GHOSTED_DAYS, MIN_SAMPLE, rate, type PassRate } from "@/lib/dashboard";
import { db } from "@/lib/db";
import { JOB_SOURCE_LABELS } from "@/lib/validation";

export const metadata = { title: "Analytics · Lamarin" };

const RANGES = [
  { key: "30", label: "30 hari", days: 30 },
  { key: "90", label: "90 hari", days: 90 },
  { key: "all", label: "Semua", days: null },
] as const;

const outOf = (count: number, of: number) => `${count} dari ${of} lamaran`;

/** Analytics = "which strategy works". Percentages only appear once there are MIN_SAMPLE applications behind them. */
export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const user = await requireUser();
  const { range: rangeParam } = await searchParams;
  const range = RANGES.find((x) => x.key === rangeParam) ?? RANGES[2];
  const now = new Date();
  const [stages, allApps, resumes] = await Promise.all([
    db.stage.findMany({ where: { userId: user.id }, select: { id: true, name: true, order: true, kind: true } }),
    db.application.findMany({
      where: { userId: user.id },
      select: {
        createdAt: true,
        source: true,
        resumeId: true,
        currentStageId: true,
        appliedAt: true,
        history: { select: { stageId: true, enteredAt: true } },
      },
    }),
    db.resume.findMany({ where: { userId: user.id }, select: { id: true, versionName: true } }),
  ]);

  // The period filters by application date (falls back to when it was added, for wishlist items).
  const facts = appFactsFor(stages, now);
  const since = range.days === null ? null : now.getTime() - range.days * 86_400_000;
  const apps = since === null ? allApps : allApps.filter((a) => (facts(a).appliedOn ?? a.createdAt).getTime() >= since);
  const d = computeDashboard(stages, apps, now);
  const o = d.outcomes;
  const resumeName = new Map(resumes.map((r) => [r.id, r.versionName]));
  const maxFunnel = Math.max(1, ...d.funnel.map((f) => f.count));
  const maxFailed = Math.max(1, ...d.failedAt.map((f) => f.count));

  return (
    <div className="max-w-7xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground text-sm">Strategi mana yang paling berhasil: sumber, versi CV, dan tahap.</p>
        </div>
        <ButtonGroup role="navigation" aria-label="Periode" className="p-1">
          {RANGES.map((x) => (
            <Link
              key={x.key}
              href={x.key === "all" ? "/analytics" : `/analytics?range=${x.key}`}
              aria-current={x.key === range.key ? "true" : undefined}
              className={buttonGroupItemClass(x.key === range.key)}
            >
              {x.label}
            </Link>
          ))}
        </ButtonGroup>
      </div>

      {o.applied === 0 ? (
        <div className="glass max-w-xl space-y-3 rounded-2xl border p-6">
          <p className="font-medium">Belum ada lamaran yang terkirim{range.days ? ` dalam ${range.label} terakhir` : ""}.</p>
          <p className="text-muted-foreground text-sm">
            Geser lamaran dari Wishlist ke tahap pertama (misalnya Administrasi) setelah kamu mengirimnya. Analisis
            muncul dari situ.
          </p>
          <Button asChild variant="outline">
            <Link href="/board">Buka board</Link>
          </Button>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-5" aria-label="Ringkasan">
            <Stat label="Response rate" value={pct(rate(o.responded, o.applied))} note={outOf(o.responded, o.applied)} />
            <Stat label="Interview rate" value={pct(rate(o.interviewed, o.applied))} note={outOf(o.interviewed, o.applied)} />
            <Stat label="Offer rate" value={pct(rate(o.offered, o.applied))} note={outOf(o.offered, o.applied)} />
            <Stat label="Ghosted" value={pct(rate(o.ghosted, o.applied))} note={outOf(o.ghosted, o.applied)} />
            <Stat
              label="Median sampai respons"
              value={d.responseTime.medianDays === null ? "–" : `${Math.round(d.responseTime.medianDays * 10) / 10} hari`}
              note={d.responseTime.sample ? `dari ${d.responseTime.sample} lamaran` : "belum ada respons"}
            />
          </section>

          <div className="grid items-start gap-4 lg:grid-cols-3">
            <Card
              title="Funnel seleksi"
              description="Jumlah lamaran yang pernah mencapai tiap tahap, dan persentase yang lanjut dari tahap sebelumnya."
              className="lg:col-span-2"
            >
              <ol className="space-y-1.5">
                {d.funnel.map((f) => (
                  <li
                    key={f.stage}
                    className="grid grid-cols-[minmax(6rem,9rem)_1fr_auto] items-center gap-3 text-sm"
                    title={`${f.stage}: ${f.count} lamaran${f.conversion === null ? "" : `, ${pct(f.conversion)} dari tahap sebelumnya`}`}
                  >
                    <span className="truncate">{f.stage}</span>
                    <span className="bg-muted h-5 rounded-md" aria-hidden>
                      <span
                        className="bg-primary block h-full origin-left rounded-md motion-safe:animate-[bar-grow_700ms_cubic-bezier(0.2,0.8,0.2,1)_both]"
                        style={{ width: `${(f.count / maxFunnel) * 100}%` }}
                      />
                    </span>
                    <span className="w-20 text-right tabular-nums">
                      <span className="font-medium">{f.count}</span>
                      {f.conversion !== null && <span className="text-muted-foreground"> · {pct(f.conversion)}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            </Card>

            <Card title="Paling sering gagal di" description="Tahap terakhir yang dicapai lamaran yang ditolak.">
              {d.failedAt.length === 0 ? (
                <p className="text-muted-foreground text-sm">Belum ada lamaran yang ditolak pada periode ini.</p>
              ) : (
                <ol className="space-y-2.5">
                  {d.failedAt.map((f) => (
                    <li key={f.stage} className="grid grid-cols-[minmax(5rem,8rem)_1fr_auto] items-center gap-3 text-sm">
                      <span className="truncate">{f.stage}</span>
                      <span className="bg-muted h-2 rounded-full" aria-hidden>
                        <span
                          className="bg-destructive/70 block h-full origin-left rounded-full motion-safe:animate-[bar-grow_700ms_cubic-bezier(0.2,0.8,0.2,1)_both]"
                          style={{ width: `${(f.count / maxFailed) * 100}%` }}
                        />
                      </span>
                      <span className="w-6 text-right font-medium tabular-nums">{f.count}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-2">
            <RateTable
              title="Per sumber lowongan"
              column="Sumber"
              adminStage={d.adminStage}
              rows={d.bySource.map((r) => ({ ...r, label: JOB_SOURCE_LABELS[r.key as JobSource] }))}
              empty="Belum ada data."
            />
            <RateTable
              title="Per versi CV"
              column="Versi CV"
              adminStage={d.adminStage}
              rows={d.byResume.map((r) => ({ ...r, label: resumeName.get(r.key as string) ?? "CV terhapus" }))}
              empty="Belum ada lamaran yang ditautkan ke CV. Pilih CV di form lamaran supaya bisa dibandingkan."
            />
          </div>

          <p className="text-muted-foreground max-w-3xl text-xs">
            Respons = perpindahan tahap pertama setelah melamar, termasuk ditolak. Interview = pernah sampai tahap yang
            namanya berisi &ldquo;Interview&rdquo;. Ghosted = masih di tahap seleksi tanpa kabar {GHOSTED_DAYS} hari atau
            lebih. Persentase baru ditampilkan kalau ada minimal {MIN_SAMPLE} lamaran di belakangnya; sebelum itu hanya
            jumlahnya.
          </p>
        </>
      )}
    </div>
  );
}

/** A count/denominator cell: the percentage once the sample is big enough, otherwise just "x/y". */
function RateCell({ count, of }: { count: number; of: number }) {
  const r = rate(count, of);
  return (
    <div className="flex items-center gap-2" title={`${count} dari ${of}`}>
      <span className="bg-muted hidden h-2 w-12 shrink-0 rounded-full xl:block" aria-hidden>
        <span className="bg-primary block h-full rounded-full" style={{ width: `${(of ? count / of : 0) * 100}%` }} />
      </span>
      <span className="whitespace-nowrap tabular-nums">
        {r !== null && <>{pct(r)} </>}
        <span className="text-muted-foreground">
          {r !== null ? "(" : ""}
          {count}/{of}
          {r !== null ? ")" : ""}
        </span>
      </span>
    </div>
  );
}

function RateTable({
  title,
  column,
  adminStage,
  className,
  rows,
  empty,
}: {
  title: string;
  column: string;
  adminStage: string | null;
  className?: string;
  rows: (PassRate & { label: string })[];
  empty: string;
}) {
  return (
    <Card
      title={title}
      description={`Respons = perusahaan bereaksi. Lolos administrasi = melewati tahap ${adminStage ?? "pertama"}.`}
      className={className}
    >
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{empty}</p>
      ) : (
        <div className="-mx-5 -mb-5 overflow-x-auto border-t">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground text-left text-xs">
              <tr>
                <th className="py-2 pl-5 font-medium">{column}</th>
                <th className="p-2 text-right font-medium">Lamaran</th>
                <th className="p-2 font-medium">Respons</th>
                <th className="py-2 pr-5 pl-2 font-medium">Lolos administrasi</th>
              </tr>
            </thead>
            <tbody className="divide-y border-t">
              {rows.map((r) => (
                <tr key={r.label}>
                  <td className="py-2.5 pl-5">{r.label}</td>
                  <td className="p-2.5 text-right tabular-nums">{r.total}</td>
                  <td className="p-2.5">
                    <RateCell count={r.responded} of={r.applied} />
                  </td>
                  <td className="py-2.5 pr-5 pl-2.5">
                    <RateCell count={r.passedAdmin} of={r.reachedAdmin} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
