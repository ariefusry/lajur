"use client";

import type { DeepPartial } from "ai";
import { Check, LoaderCircle } from "lucide-react";
import type { ExtractEvent } from "@/lib/ai/extract-events";
import type { ExtractedJob } from "@/lib/ai/extract-job";
import { REQUIREMENT_TYPE_LABELS } from "@/lib/validation";

type Status = Extract<ExtractEvent, { type: "status" }>["status"];

const HEADLINE: Record<Status, string> = {
  fetching: "Mengambil halaman lowongan…",
  reading: "AI sedang membaca lowongan…",
  retrying: "Hasil belum rapi, AI membaca ulang lebih teliti…",
  fallback: "Server AI utama sibuk, pindah ke server cadangan…",
  verifying: "Mencocokkan kutipan dengan teks lowongan…",
};

const formatDate = (iso: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(iso))
    : iso;

/** Turns the partially written object into readable lines, in the order the model writes them. */
export function findingLines(job: DeepPartial<ExtractedJob>): string[] {
  const lines: string[] = [];
  if (job.company) lines.push(`Perusahaan: ${job.company}`);
  if (job.position) lines.push(`Posisi: ${job.position}`);
  if (job.location) lines.push(`Lokasi: ${job.location}`);
  if (job.deadline) lines.push(`Deadline: ${formatDate(job.deadline)}`);
  // The model writes the evidence quotes between the basic fields and the skills.
  if (job.quotes && !job.skills?.length && !job.requirements?.length) lines.push("Mengumpulkan kutipan bukti dari lowongan");
  const skills = (job.skills ?? []).map((s) => s?.name).filter(Boolean);
  if (skills.length) lines.push(`Skill: ${skills.join(", ")}`);
  for (const r of job.requirements ?? []) {
    if (r?.type && r.value) lines.push(`Syarat ${REQUIREMENT_TYPE_LABELS[r.type].toLowerCase()}: ${r.value}`);
  }
  return lines;
}

/**
 * Live progress while the AI reads, at a fixed height: only the newest finding (one line, replaced as the next
 * one arrives) and a running count. Everything found lands in the form once it's done.
 */
export function AiFindings({ status, job, elapsed }: { status: Status; job: DeepPartial<ExtractedJob> | null; elapsed: number }) {
  const lines = job ? findingLines(job) : [];
  const latest = lines.at(-1);
  // The newest line may still be being written.
  const writing = status !== "verifying";
  return (
    <div className="space-y-1.5 rounded-xl border bg-card p-3">
      <p className="flex items-center gap-2 text-sm font-medium">
        <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
        {HEADLINE[status]}
        <span className="ml-auto text-xs font-normal text-muted-foreground tabular-nums">{elapsed} dtk</span>
      </p>
      {/* Only this line is announced, not the ticking seconds above. */}
      <div className="flex h-5 items-center gap-2 text-sm" aria-live="polite">
        {latest ? (
          <>
            {writing ? (
              <span className="size-2 shrink-0 rounded-full bg-primary motion-safe:animate-pulse" aria-hidden />
            ) : (
              <Check className="size-4 shrink-0 text-green-600" aria-hidden />
            )}
            <span
              key={lines.length}
              title={latest}
              className="min-w-0 truncate motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-300"
            >
              {latest}
            </span>
          </>
        ) : (
          status !== "fetching" && <span className="text-muted-foreground text-xs">Menunggu temuan pertama dari AI…</span>
        )}
      </div>
      <p className="text-muted-foreground text-xs tabular-nums">
        {lines.length > 0 ? `${lines.length} temuan sejauh ini · semuanya diisikan ke form setelah selesai` : " "}
      </p>
    </div>
  );
}
