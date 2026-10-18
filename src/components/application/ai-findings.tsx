"use client";

import { LoaderCircle } from "lucide-react";
import type { ExtractEvent } from "@/lib/ai/extract-events";

type Status = Extract<ExtractEvent, { type: "status" }>["status"];

const HEADLINE: Record<Status, string> = {
  fetching: "Mengambil halaman lowongan…",
  reading: "AI sedang membaca lowongan…",
  retrying: "Hasil belum rapi, AI membaca ulang lebih teliti…",
  fallback: "Server AI utama sibuk, pindah ke server cadangan…",
  verifying: "Mencocokkan kutipan dengan teks lowongan…",
};

/**
 * Progress while the AI reads, at a fixed height. The answer isn't streamed (strict JSON output can't be),
 * so this shows the current step; everything found lands in the form once it's done.
 */
export function AiFindings({ status, elapsed }: { status: Status; elapsed: number }) {
  return (
    <div className="space-y-1.5 rounded-xl border bg-card p-3">
      <p className="flex items-center gap-2 text-sm font-medium">
        <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
        {/* Only the step is announced, not the ticking seconds. */}
        <span aria-live="polite">{HEADLINE[status]}</span>
        <span className="ml-auto text-xs font-normal text-muted-foreground tabular-nums">{elapsed} dtk</span>
      </p>
      <p className="text-muted-foreground text-xs">Hasilnya langsung diisikan ke form sebagai draf untuk kamu tinjau.</p>
    </div>
  );
}
