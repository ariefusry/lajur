import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { JobSource } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth";
import { computeDashboard, type PassRate } from "@/lib/dashboard";
import { db } from "@/lib/db";
import { JOB_SOURCE_LABELS } from "@/lib/validation";

export const metadata = { title: "Dashboard · Lamarin" };

const pct = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)}%`);

export default async function DashboardPage() {
  const user = await requireUser();
  const [stages, apps, resumes] = await Promise.all([
    db.stage.findMany({ where: { userId: user.id }, select: { id: true, name: true, order: true, kind: true } }),
    db.application.findMany({
      where: { userId: user.id },
      select: {
        source: true,
        resumeId: true,
        currentStageId: true,
        appliedAt: true,
        history: { select: { stageId: true, enteredAt: true } },
      },
    }),
    db.resume.findMany({ where: { userId: user.id }, select: { id: true, versionName: true } }),
  ]);

  if (apps.length === 0) {
    return (
      <div className="max-w-xl space-y-4">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <div className="space-y-3 rounded-xl border p-6">
          <p className="font-medium">Belum ada data untuk dianalisis.</p>
          <p className="text-sm text-muted-foreground">
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

  return (
    <div className="max-w-4xl space-y-8">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Ringkasan">
        <Stat label="Total lamaran" value={d.totals.applications} />
        <Stat label="Masih berjalan" value={d.totals.active} />
        <Stat label="Offering" value={d.totals.offers} />
        <Stat
          label="Median waktu respons"
          value={d.responseTime.medianDays === null ? "–" : `${Math.round(d.responseTime.medianDays * 10) / 10} hari`}
          note={d.responseTime.sample ? `dari ${d.responseTime.sample} lamaran` : "belum ada perpindahan tahap"}
        />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-medium">Funnel seleksi</h2>
          <p className="text-xs text-muted-foreground">
            Jumlah lamaran yang pernah mencapai tiap tahap, dan persentase yang lanjut dari tahap sebelumnya.
          </p>
        </div>
        <ol className="space-y-2">
          {d.funnel.map((f) => (
            <li
              key={f.stage}
              className="grid grid-cols-[minmax(6rem,9rem)_1fr_auto] items-center gap-3 text-sm"
              title={`${f.stage}: ${f.count} lamaran${f.conversion === null ? "" : `, ${pct(f.conversion)} dari tahap sebelumnya`}`}
            >
              <span className="truncate">{f.stage}</span>
              <span className="h-5 rounded-sm bg-muted" aria-hidden>
                <span className="block h-full rounded-sm bg-primary" style={{ width: `${(f.count / maxFunnel) * 100}%` }} />
              </span>
              <span className="w-24 text-right tabular-nums">
                <span className="font-medium">{f.count}</span>
                {f.conversion !== null && <span className="text-muted-foreground"> · {pct(f.conversion)}</span>}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <PassTable
        title="Per sumber lowongan"
        empty="Belum ada data."
        adminStage={d.adminStage}
        rows={d.bySource.map((r) => ({ ...r, label: JOB_SOURCE_LABELS[r.key as JobSource] }))}
      />
      <PassTable
        title="Per versi CV"
        empty="Belum ada lamaran yang ditautkan ke CV. Pilih CV di form lamaran supaya bisa dibandingkan."
        adminStage={d.adminStage}
        rows={d.byResume.map((r) => ({ ...r, label: resumeName.get(r.key as string) ?? "CV terhapus" }))}
      />
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: number | string; note?: string }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
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
        <p className="text-xs text-muted-foreground">
          Lolos administrasi = sudah melewati tahap {adminStage ?? "pertama"}, dihitung dari lamaran yang sudah sampai
          tahap itu.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
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
                      <span className="h-2 w-24 shrink-0 rounded-full bg-muted" aria-hidden>
                        <span className="block h-full rounded-full bg-primary" style={{ width: `${(r.rate ?? 0) * 100}%` }} />
                      </span>
                      <span className="tabular-nums">
                        {pct(r.rate)}
                        <span className="text-muted-foreground"> ({r.passedAdmin}/{r.reachedAdmin})</span>
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
