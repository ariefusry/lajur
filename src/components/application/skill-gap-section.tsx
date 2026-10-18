"use client";

import { LoaderCircle, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CV_CHECK_PRIVACY_NOTE, CvCheckResults, requestCvCheck, type CvCheckRow } from "@/components/application/cv-check";
import { ShinyButton } from "@/components/ui/shiny-button";
import type { CvTweak } from "@/lib/ai/cv-tweaks";

/** "Cek CV" tab of a saved application: the saved result, and a button to (re)check the linked CV. */
export function SkillGapSection({
  applicationId,
  gaps,
  tweaks,
  blocker,
  readOnly = false,
}: {
  applicationId: string;
  gaps: CvCheckRow[];
  tweaks: CvTweak[];
  /** Why the check can't run yet (no posting text / no CV), or null. */
  blocker: string | null;
  /** Read-only demo: show existing results, no (re)check. */
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function check() {
    setPending(true);
    if (await requestCvCheck({ applicationId })) router.refresh();
    setPending(false);
  }

  const checked = gaps.length > 0 || tweaks.length > 0;
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-medium">Cek CV</h2>
          <p className="text-xs text-muted-foreground">{CV_CHECK_PRIVACY_NOTE}</p>
        </div>
        {!blocker && !readOnly && (
          <ShinyButton size="sm" onClick={check} disabled={pending}>
            {pending ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : <Sparkles />}
            {pending ? "Mengecek CV…" : checked ? "Cek ulang" : "Cek CV"}
          </ShinyButton>
        )}
      </div>

      {checked ? (
        <CvCheckResults rows={gaps} tweaks={tweaks} />
      ) : (
        <p className="text-sm text-muted-foreground">
          {blocker ??
            (readOnly
              ? "Cek CV tidak tersedia di mode demo."
              : "Belum dicek. Skill yang tertulis di CV dicocokkan langsung; sisanya dicek AI, lalu AI memberi saran perbaikan CV.")}
        </p>
      )}
    </section>
  );
}
