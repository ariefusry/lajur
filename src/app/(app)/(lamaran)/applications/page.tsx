import { CalendarClock } from "lucide-react";
import { ApplicationFilters } from "@/components/application/application-filters";
import { RememberApplicationsView } from "@/components/application/back-to-applications";
import Link from "next/link";
import { EligibilityBadge } from "@/components/eligibility-badge";
import { Badge } from "@/components/ui/badge";
import type { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth";
import { appFactsFor, GHOSTED_DAYS } from "@/lib/dashboard";
import { daysUntil, formatDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { checkRequirement, overallStatus } from "@/lib/eligibility/check";
import { getEligibilityProfile } from "@/lib/eligibility/profile";
import { cn } from "@/lib/utils";
import { JOB_SOURCE_LABELS } from "@/lib/validation";

export const metadata = { title: "Daftar lamaran · Lajur" };

const SORTS = {
  updated: { label: "Terbaru diubah", orderBy: { updatedAt: "desc" } },
  applied: {
    label: "Tanggal melamar",
    orderBy: [{ appliedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
  },
  deadline: { label: "Deadline terdekat", orderBy: { deadline: { sort: "asc", nulls: "last" } } },
  company: { label: "Perusahaan (A–Z)", orderBy: { company: "asc" } },
} satisfies Record<
  string,
  { label: string; orderBy: Prisma.ApplicationOrderByWithRelationInput | Prisma.ApplicationOrderByWithRelationInput[] }
>;

type Search = { q?: string; stage?: string; sort?: string };
/** Stage filter value for derived "ghosted" applications (not a real stage). */
const GHOSTED = "ghosted";

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const { q = "", stage = "", sort = "updated" } = await searchParams;
  const sortKey = (sort in SORTS ? sort : "updated") as keyof typeof SORTS;
  const query = q.trim();

  const [stages, applications, total, profile] = await Promise.all([
    db.stage.findMany({
      where: { userId: user.id },
      orderBy: { order: "asc" },
      select: { id: true, name: true, order: true, kind: true },
    }),
    db.application.findMany({
      where: {
        userId: user.id,
        ...(stage && stage !== GHOSTED && { currentStageId: stage }),
        ...(query && {
          OR: [
            { company: { contains: query, mode: "insensitive" } },
            { position: { contains: query, mode: "insensitive" } },
            { location: { contains: query, mode: "insensitive" } },
          ],
        }),
      },
      orderBy: SORTS[sortKey].orderBy,
      select: {
        id: true,
        company: true,
        position: true,
        source: true,
        location: true,
        deadline: true,
        appliedAt: true,
        currentStageId: true,
        history: { select: { stageId: true, enteredAt: true } },
        resume: { select: { versionName: true } },
        requirements: { select: { type: true, value: true, ageReferenceDate: true } },
      },
    }),
    db.application.count({ where: { userId: user.id } }),
    getEligibilityProfile(user.id),
  ]);
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const today = new Date();
  const factsOf = appFactsFor(stages, today);
  const rows = applications
    .map(({ requirements, ...a }) => ({
      ...a,
      stage: stageById.get(a.currentStageId),
      ghosted: factsOf(a).ghosted,
      eligibility: overallStatus(requirements.map((r) => checkRequirement(r, profile, today).status)),
    }))
    .filter((a) => stage !== GHOSTED || a.ghosted);
  const filtered = Boolean(query || stage);

  return (
    <div className="max-w-7xl space-y-4 motion-safe:animate-[fade-in_300ms_ease-out]">
      <RememberApplicationsView />
      <ApplicationFilters
        query={query}
        stage={stage}
        sort={sortKey}
        stageOptions={[
          { value: "", label: "Semua tahap" },
          ...stages.map((s) => ({ value: s.id, label: s.name })),
          { value: GHOSTED, label: "Ghosted" },
        ]}
        sortOptions={Object.entries(SORTS).map(([value, s]) => ({ value, label: s.label }))}
        filtered={filtered}
      />

      <p className="text-muted-foreground text-sm">
        {filtered ? `${rows.length} dari ${total} lamaran` : `${total} lamaran`}
      </p>

      {rows.length === 0 ? (
        <div className="glass rounded-2xl border p-6 text-sm">
          {total === 0 ? (
            <p>
              Belum ada lamaran.{" "}
              <Link href="/applications/new" className="text-primary font-medium hover:underline">
                Tambah lamaran pertama
              </Link>
            </p>
          ) : (
            <p className="text-muted-foreground">Tidak ada lamaran yang cocok dengan filter ini.</p>
          )}
        </div>
      ) : (
        <>
          {/* Desktop: table */}
          <div className="glass hidden overflow-hidden rounded-2xl border md:block">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground border-b text-left text-xs">
                <tr>
                  <th className="py-2.5 pl-5 font-medium">Perusahaan</th>
                  <th className="p-2.5 font-medium">Tahap</th>
                  <th className="p-2.5 font-medium">Sumber</th>
                  <th className="p-2.5 font-medium">Melamar</th>
                  <th className="p-2.5 font-medium">Deadline</th>
                  <th className="py-2.5 pr-5 pl-2.5 font-medium">Kelayakan</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((a) => (
                  <tr key={a.id} className="hover:bg-foreground/5 relative transition-colors">
                    <td className="py-3 pl-5">
                      {/* The whole row is clickable through this stretched link. */}
                      <Link href={`/applications/${a.id}`} className="font-medium after:absolute after:inset-0">
                        {a.company}
                      </Link>
                      <p className="text-muted-foreground text-xs">
                        {a.position}
                        {a.location && ` · ${a.location}`}
                      </p>
                    </td>
                    <td className="p-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StageBadge name={a.stage?.name} kind={a.stage?.kind} />
                        {a.ghosted && <GhostedBadge />}
                      </div>
                    </td>
                    <td className="text-muted-foreground p-2.5">{JOB_SOURCE_LABELS[a.source]}</td>
                    <td className="text-muted-foreground p-2.5 whitespace-nowrap">
                      {a.appliedAt ? formatDate(a.appliedAt) : "–"}
                    </td>
                    <td className="p-2.5 whitespace-nowrap">
                      <Deadline date={a.deadline} />
                    </td>
                    <td className="py-2.5 pr-5 pl-2.5">
                      {a.eligibility ? (
                        <EligibilityBadge status={a.eligibility} />
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phone: one compact card per application */}
          <ul className="glass divide-y overflow-hidden rounded-2xl border md:hidden">
            {rows.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/applications/${a.id}`}
                  className="hover:bg-foreground/5 block space-y-1.5 px-4 py-3 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{a.company}</p>
                      <p className="text-muted-foreground truncate text-xs">{a.position}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <StageBadge name={a.stage?.name} kind={a.stage?.kind} />
                      {a.ghosted && <GhostedBadge />}
                    </div>
                  </div>
                  <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span>{JOB_SOURCE_LABELS[a.source]}</span>
                    {a.deadline && <Deadline date={a.deadline} />}
                    {a.eligibility && <EligibilityBadge status={a.eligibility} />}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function GhostedBadge() {
  return (
    <Badge
      variant="secondary"
      className="bg-amber-500/15 text-amber-700 dark:text-amber-300"
      title={`Tanpa kabar ${GHOSTED_DAYS} hari atau lebih`}
    >
      Ghosted
    </Badge>
  );
}

function StageBadge({ name, kind }: { name?: string; kind?: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "shrink-0",
        kind === "OFFER" && "bg-green-600/15 text-green-700 dark:text-green-400",
        (kind === "REJECTED" || kind === "WITHDRAWN") && "bg-destructive/10 text-destructive",
        kind === "IN_PROGRESS" && "bg-primary/10 text-primary",
      )}
    >
      {name ?? "–"}
    </Badge>
  );
}

function Deadline({ date }: { date: Date | null }) {
  if (!date) return <span className="text-muted-foreground">–</span>;
  const days = daysUntil(date);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        days >= 0 && days <= 3 ? "text-destructive font-medium" : "text-muted-foreground",
      )}
      title={days < 0 ? "Deadline sudah lewat" : `${days} hari lagi`}
    >
      <CalendarClock className="size-3.5" aria-hidden />
      {formatDate(date)}
    </span>
  );
}
