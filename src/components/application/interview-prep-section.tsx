"use client";

import { ChevronDown, LoaderCircle, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { ShinyButton } from "@/components/ui/shiny-button";
import { CATEGORY_LABELS, type StoredInterviewPrep } from "@/lib/ai/interview-prep";

export type PrepView = StoredInterviewPrep & { stageId: string; whenLabel: string };

export const INTERVIEW_PRIVACY_NOTE =
  "Teks lowongan, perusahaan, posisi, gaji yang diharapkan, dan bagian keahlian dan pengalaman CV (tanpa nama dan kontak) dikirim ke AI. Catatan tahap tidak dikirim.";

/** "Interview" tab of a saved application: questions and answer outlines for the current stage. */
export function InterviewPrepSection({
  applicationId,
  stageName,
  blocker,
  hasPosting,
  current,
  others,
  readOnly = false,
}: {
  applicationId: string;
  stageName: string;
  /** Why nothing can be made for this stage (not an interview, closed), or null. */
  blocker: string | null;
  hasPosting: boolean;
  /** The saved preparation for the current stage, or null. */
  current: PrepView | null;
  /** Saved preparations for earlier stages. */
  others: PrepView[];
  /** Read-only demo: show what exists, no generating. */
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function generate() {
    setPending(true);
    try {
      const res = await fetch("/api/ai/interview-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Gagal membuat persiapan. Coba lagi.");
        return;
      }
      toast.success("Persiapan interview siap.");
      router.refresh();
    } catch {
      toast.error("Koneksi gagal. Coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-medium">Persiapan interview</h2>
          <p className="text-muted-foreground max-w-prose text-xs">{INTERVIEW_PRIVACY_NOTE}</p>
        </div>
        {!blocker && !readOnly && (
          <ShinyButton size="sm" onClick={generate} disabled={pending}>
            {pending ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : <Sparkles />}
            {pending ? "Menyusun pertanyaan…" : current ? "Buat ulang" : `Buat untuk ${stageName}`}
          </ShinyButton>
        )}
      </div>

      {current ? (
        <div className="space-y-4">
          <p className="text-muted-foreground text-xs">
            Untuk tahap <span className="text-foreground font-medium">{current.stageName}</span>, dibuat{" "}
            {current.whenLabel}.
            {!current.usedPosting && " Tanpa teks lowongan, jadi pertanyaannya lebih umum."}
            {!current.usedCv && " Tanpa CV, jadi kerangka jawabannya belum merujuk pengalamanmu."}
          </p>
          <PrepList prep={current} />
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          {blocker ??
            (readOnly
              ? "Persiapan interview tidak tersedia di mode demo."
              : `Belum ada persiapan untuk tahap ${stageName}. AI menyusun pertanyaan yang mungkin ditanyakan, kerangka jawabannya, dan pertanyaan untuk pewawancara.${hasPosting ? "" : ' Lamaran yang dibuat lewat "Tambah dengan AI" menyimpan teks lowongan, jadi pertanyaannya lebih tepat.'}`)}
        </p>
      )}

      {others.length > 0 && (
        <details className="rounded-2xl border">
          <summary className="focus-visible:ring-ring/50 cursor-pointer rounded-2xl px-4 py-3 text-sm font-medium outline-none focus-visible:ring-[3px]">
            Persiapan tahap lain ({others.length})
          </summary>
          <div className="space-y-5 border-t p-4">
            {others.map((p) => (
              <div key={p.stageId} className="space-y-2">
                <h3 className="text-sm font-medium">
                  {p.stageName} <span className="text-muted-foreground font-normal">· {p.whenLabel}</span>
                </h3>
                <PrepList prep={p} />
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function PrepList({ prep }: { prep: StoredInterviewPrep }) {
  return (
    <div className="space-y-4">
      <ol className="divide-y rounded-2xl border">
        {prep.questions.map((q, i) => (
          <li key={i}>
            <details className="group">
              <summary className="focus-visible:ring-ring/50 flex cursor-pointer list-none items-start gap-3 rounded-2xl p-3 outline-none focus-visible:ring-[3px] [&::-webkit-details-marker]:hidden">
                <span className="text-muted-foreground w-5 shrink-0 pt-0.5 text-sm tabular-nums">{i + 1}.</span>
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="block text-sm font-medium">{q.question}</span>
                  <Badge variant="outline">{CATEGORY_LABELS[q.category]}</Badge>
                </span>
                <ChevronDown
                  className="text-muted-foreground mt-0.5 size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                  aria-hidden
                />
              </summary>
              <div className="space-y-3 px-3 pb-3 pl-11 text-sm">
                <div className="space-y-0.5">
                  <p>{q.why}</p>
                  {q.quote && (
                    <p className="text-muted-foreground text-xs">
                      Di lowongan: <q className="italic">{q.quote}</q>
                    </p>
                  )}
                </div>
                {q.answerPoints.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs font-medium">Kerangka jawaban</p>
                    <ul className="list-disc space-y-1 pl-4">
                      {q.answerPoints.map((p, j) => (
                        <li key={j}>{p}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {q.cvQuote && (
                  <p className="text-muted-foreground text-xs">
                    Bahan dari CV: <q className="italic">{q.cvQuote}</q>
                  </p>
                )}
                <p>
                  <span className="font-medium">Tip:</span> {q.tip}
                </p>
              </div>
            </details>
          </li>
        ))}
      </ol>
      {prep.questionsToAsk.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-sm font-medium">Pertanyaan untuk pewawancara</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {prep.questionsToAsk.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
