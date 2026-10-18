"use client";

import { LoaderCircle } from "lucide-react";
import type { ExtractEvent } from "@/lib/ai/extract-events";

type Status = Extract<ExtractEvent, { type: "status" }>["status"];

// Short enough for one line in the 26rem panel.
const HEADLINE: Record<Status, string> = {
  fetching: "Mengambil halaman lowongan…",
  reading: "AI sedang membaca lowongan…",
  retrying: "AI membaca ulang lebih teliti…",
  fallback: "Mencoba model AI cadangan…",
  verifying: "Mencocokkan kutipan…",
};

/**
 * Progress while the AI reads, at a fixed height. The answer isn't streamed (strict JSON output can't be),
 * so this shows the current step; everything found lands in the form once it's done.
 */
export function ExtractProgress({ status, elapsed }: { status: Status; elapsed: number }) {
  return (
    <div className="bg-card space-y-1.5 rounded-xl border p-3">
      <p className="flex items-center gap-2 text-sm font-medium">
        <LoaderCircle className="size-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />
        {/* Only the step is announced, not the ticking seconds. */}
        <span aria-live="polite" title={HEADLINE[status]} className="min-w-0 truncate">
          {HEADLINE[status]}
        </span>
        <span className="text-muted-foreground ml-auto shrink-0 text-xs font-normal whitespace-nowrap tabular-nums">
          {elapsed} dtk
        </span>
      </p>
      <p className="text-muted-foreground truncate text-xs">Hasilnya langsung diisikan ke form sebagai draf.</p>
    </div>
  );
}
