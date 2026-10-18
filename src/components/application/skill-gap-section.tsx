"use client";

import { CircleCheck, CircleX, LoaderCircle, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Gap = { id: string; skill: string; inResume: boolean; suggestion: string | null; sourceQuote: string | null };

export function SkillGapSection({
  applicationId,
  gaps,
  blocker,
  readOnly = false,
}: {
  applicationId: string;
  gaps: Gap[];
  /** Why analysis can't run yet (no posting text / no CV), or null. */
  blocker: string | null;
  /** Read-only demo: show existing results, no (re)analysis. */
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function analyze() {
    setPending(true);
    try {
      const res = await fetch("/api/ai/skill-gap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return toast.error(body.error ?? "Analisis gagal. Coba lagi.");
      if (body.aiNote) toast.warning(body.aiNote);
      else toast.success(`Selesai: ${body.matchedWithoutAi} cocok langsung, ${body.checkedByAi} dicek AI.`);
      router.refresh();
    } catch {
      toast.error("Koneksi gagal. Coba lagi.");
    } finally {
      setPending(false);
    }
  }

  const have = gaps.filter((g) => g.inResume);
  const missing = gaps.filter((g) => !g.inResume);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-medium">Skill vs CV</h2>
          <p className="text-xs text-muted-foreground">
            Hanya bagian keahlian dan pengalaman (tanpa nama dan kontak) yang dikirim ke AI.
          </p>
        </div>
        {!blocker && !readOnly && (
          <Button type="button" variant="outline" size="sm" onClick={analyze} disabled={pending}>
            {pending ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : <Sparkles />}
            {pending ? "Mencocokkan skill dengan CV…" : gaps.length ? "Analisis ulang" : "Analisis skill"}
          </Button>
        )}
      </div>

      {gaps.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {blocker ??
            (readOnly
              ? "Analisis skill tidak tersedia di mode demo."
              : "Belum dianalisis. Skill yang tertulis di CV dicocokkan langsung; sisanya dicek AI untuk istilah setara.")}
        </p>
      ) : (
        <>
          <p className="text-sm">
            <span className="font-medium">{have.length}</span> dari {gaps.length} skill sudah terlihat di CV.
          </p>
          <ul className="divide-y rounded-xl border bg-card">
            {[...have, ...missing].map((g) => (
              <li key={g.id} className="flex gap-3 p-3 text-sm">
                {g.inResume ? (
                  <CircleCheck className="mt-0.5 size-4 shrink-0 text-green-600" aria-label="Ada di CV" />
                ) : (
                  <CircleX className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="Belum ada di CV" />
                )}
                <div className="min-w-0 space-y-0.5">
                  <p className="font-medium">
                    {g.skill} <span className="font-normal text-muted-foreground">· {g.inResume ? "ada" : "belum ada"}</span>
                  </p>
                  {g.sourceQuote && (
                    <p className="text-xs text-muted-foreground">
                      Di CV: <q className="italic">{g.sourceQuote}</q>
                    </p>
                  )}
                  {g.suggestion && <p className="text-xs">{g.suggestion}</p>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
