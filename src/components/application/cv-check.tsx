"use client";

import { CircleCheck, CirclePlus, CircleX, Copy, LoaderCircle, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShinyButton } from "@/components/ui/shiny-button";
import type { CvTweak } from "@/lib/ai/cv-tweaks";

export type CvCheckRow = { skill: string; inResume: boolean; suggestion: string | null; sourceQuote: string | null };
type CheckResponse = { rows: CvCheckRow[]; tweaks: CvTweak[]; matchedWithoutAi: number; checkedByAi: number; aiNote: string | null };

export const CV_CHECK_PRIVACY_NOTE = "Hanya bagian keahlian dan pengalaman (tanpa nama dan kontak) yang dikirim ke AI.";

/** POST /api/ai/skill-gap; shows the error/AI note as a toast and returns the result, or null on failure. */
export async function requestCvCheck(body: { applicationId: string } | { text: string; resumeId: string }) {
  try {
    const res = await fetch("/api/ai/skill-gap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Cek CV gagal. Coba lagi.");
      return null;
    }
    const result = data as CheckResponse;
    if (result.aiNote) toast.warning(result.aiNote);
    else toast.success(`Selesai: ${result.rows.length} skill dicek, ${result.tweaks.length} saran untuk CV.`);
    return result;
  } catch {
    toast.error("Koneksi gagal. Coba lagi.");
    return null;
  }
}

function CopyButton({ text }: { text: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Salin saran"
      title="Salin saran"
      onClick={() =>
        navigator.clipboard.writeText(text).then(
          () => toast.success("Saran disalin."),
          () => toast.error("Gagal menyalin. Salin manual saja."),
        )
      }
    >
      <Copy />
    </Button>
  );
}

/** Skills found / missing in the CV, then the CV tweaks. Shared by the new-application form and the detail tab. */
export function CvCheckResults({ rows, tweaks }: { rows: CvCheckRow[]; tweaks: CvTweak[] }) {
  const have = rows.filter((r) => r.inResume);
  const missing = rows.filter((r) => !r.inResume);
  const rewrites = tweaks.filter((t) => t.kind === "rewrite");
  const adds = tweaks.filter((t) => t.kind === "add");
  return (
    <div className="space-y-4">
      {rows.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm">
            <span className="font-medium">{have.length}</span> dari {rows.length} skill sudah terlihat di CV.
          </p>
          <ul className="glass divide-y rounded-2xl border">
            {[...have, ...missing].map((g) => (
              <li key={g.skill} className="flex gap-3 p-3 text-sm">
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
        </div>
      )}
      {rewrites.length > 0 && (
        <div className="space-y-2">
          <div>
            <h3 className="text-sm font-medium">Tulis ulang bagian CV</h3>
            <p className="text-xs text-muted-foreground">Hanya memoles yang sudah tertulis di CV-mu. Baca lagi sebelum menyalin.</p>
          </div>
          <ol className="space-y-2">
            {rewrites.map((t, i) => (
              <li key={i} className="space-y-1.5 rounded-xl border bg-card p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline">{t.section}</Badge>
                  <CopyButton text={t.suggestion} />
                </div>
                {t.current && (
                  <p className="text-xs text-muted-foreground">
                    Sekarang: <q className="italic">{t.current}</q>
                  </p>
                )}
                <p className="whitespace-pre-line">{t.suggestion}</p>
                <p className="text-xs text-muted-foreground">{t.reason}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
      {adds.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Bisa dilengkapi, kalau memang kamu punya</h3>
          <ul className="glass divide-y rounded-2xl border">
            {adds.map((t, i) => (
              <li key={i} className="flex gap-3 p-3 text-sm">
                <CirclePlus className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0 space-y-0.5">
                  <p>
                    <span className="font-medium">{t.section}:</span> {t.suggestion}
                  </p>
                  <p className="text-xs text-muted-foreground">{t.reason}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {rows.length === 0 && tweaks.length === 0 && (
        <p className="text-sm text-muted-foreground">Tidak ada skill atau saran yang bisa ditampilkan untuk lowongan ini.</p>
      )}
    </div>
  );
}

/**
 * "Cek CV" next to the new-application form, before saving: checks the CV picked in the form (found by
 * `formId`) against the AI draft's posting. The result joins that form through a hidden "cvCheck" field
 * (`form` attribute) and is saved with the application.
 */
export function NewApplicationCvCheck({
  formId,
  text,
  resumes,
}: {
  formId: string;
  text: string;
  resumes: { id: string; versionName: string }[];
}) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ resumeId: string; rows: CvCheckRow[]; tweaks: CvTweak[] } | null>(null);

  async function run() {
    const form = document.getElementById(formId);
    const resumeId = form instanceof HTMLFormElement ? String(new FormData(form).get("resumeId") ?? "") : "";
    if (!resumeId) {
      toast.error(resumes.length ? "Pilih dulu CV yang dikirim di atas." : "Unggah CV dulu di menu CV.");
      return;
    }
    setPending(true);
    const checked = await requestCvCheck({ text, resumeId });
    setPending(false);
    if (checked) setResult({ resumeId, rows: checked.rows, tweaks: checked.tweaks });
  }

  const cvName = result && resumes.find((r) => r.id === result.resumeId)?.versionName;
  return (
    <section className="glass space-y-3 rounded-2xl border p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-medium">
            <Sparkles className="size-4" /> Cek CV untuk lowongan ini
          </h2>
          <p className="text-xs text-muted-foreground">
            Lihat skill yang belum terlihat di CV dan apa yang perlu ditambahkan sebelum melamar. {CV_CHECK_PRIVACY_NOTE}
          </p>
        </div>
        <ShinyButton size="sm" onClick={run} disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : <Sparkles />}
          {pending ? "Mengecek CV…" : result ? "Cek ulang" : "Cek CV"}
        </ShinyButton>
      </div>
      {result && (
        <>
          <p className="text-xs text-muted-foreground">
            Hasil untuk CV <span className="font-medium text-foreground">{cvName ?? "terpilih"}</span>. Ikut tersimpan bersama
            lamaran selama CV yang dikirim tetap ini.
          </p>
          <CvCheckResults rows={result.rows} tweaks={result.tweaks} />
          <input type="hidden" form={formId} name="cvCheck" value={JSON.stringify(result)} />
        </>
      )}
    </section>
  );
}
