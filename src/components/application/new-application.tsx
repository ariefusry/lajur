"use client";

import { CircleCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { createApplication } from "@/actions/applications";
import { ApplicationForm, type ApplicationDefaults, type Evidence } from "@/components/application/application-form";
import { NewApplicationCvCheck } from "@/components/application/cv-check";
import { JobPastePanel, type ExtractResult } from "@/components/application/job-paste-panel";
import { RequirementsEditor } from "@/components/application/requirements-editor";
import { AiConsent } from "@/components/settings/ai-consent";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  aiEnabled: boolean;
  aiConsent: boolean;
  stages: { id: string; name: string }[];
  resumes: { id: string; versionName: string }[];
  defaults: ApplicationDefaults;
  profile: React.ComponentProps<typeof RequirementsEditor>["profile"];
};

const FORM_ID = "new-application";
const WORK_MODE_LABELS = { onsite: "Kerja di kantor", hybrid: "Hybrid", remote: "Remote" } as const;

/** Posting details the form has no field for, as a first line of the notes draft. */
function postingNotes(job: ExtractResult["job"]) {
  const parts = [job.employmentType, job.workMode && WORK_MODE_LABELS[job.workMode], job.salaryRange && `Gaji ${job.salaryRange}`];
  const line = parts.filter(Boolean).join(" · ");
  return line ? `Dari lowongan: ${line}` : "";
}

export function NewApplication({ aiEnabled, aiConsent, stages, resumes, defaults, profile }: Props) {
  const [draft, setDraft] = useState<ExtractResult | null>(null);
  const [version, setVersion] = useState(0);
  // With AI on, the long manual form stays folded until it is needed (or the AI filled a draft).
  const [manual, setManual] = useState(false);
  // Once the AI filled the draft the paste panel folds into a one-line summary, freeing the column for "Cek CV".
  const [pasteOpen, setPasteOpen] = useState(true);
  // Local, so agreeing shows the paste panel right away (see AiConsent).
  const [consented, setConsented] = useState(aiConsent);

  const job = draft?.job;
  const merged: ApplicationDefaults = job
    ? {
        ...defaults,
        company: job.company ?? "",
        position: job.position ?? "",
        location: job.location ?? "",
        deadline: job.deadline ?? "",
        url: draft.sourceUrl ?? job.sourceUrl ?? defaults.url,
        notes: postingNotes(job) || defaults.notes,
      }
    : defaults;
  const evidence: Evidence | undefined = job
    ? {
        company: job.quotes.company,
        position: job.quotes.position,
        location: job.quotes.location,
        deadline: job.quotes.deadline,
      }
    : undefined;

  return (
    // Desktop: AI column (paste → draft summary + "Cek CV") next to the form.
    // Phone: one column in the order paste/summary, form, "Cek CV".
    <div className={aiEnabled ? "flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start" : "space-y-6"}>
      {aiEnabled && (
        <div className={cn("contents lg:flex lg:flex-col lg:gap-6", !draft && "lg:sticky lg:top-6")}>
          <div className="order-1 lg:order-none">
            {!consented ? (
              <section className="glass space-y-3 rounded-2xl border p-4">
                <h2 className="flex items-center gap-2 font-medium">
                  <Sparkles className="size-4" /> Tambah dengan AI
                </h2>
                <AiConsent consentedAt={null} onChange={setConsented} />
              </section>
            ) : job && !pasteOpen ? (
              <section className="glass flex flex-wrap items-start gap-3 rounded-2xl border p-4">
                <CircleCheck className="mt-0.5 size-5 shrink-0 text-green-600" aria-hidden />
                <div className="min-w-0 flex-1 basis-56">
                  <h2 className="font-medium">Draf diisi dari lowongan</h2>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {[job.position, job.company].filter(Boolean).join(" · ") || "Tinjau isi form-nya."}
                  </p>
                </div>
                {/* Wraps under the text, lined up with it (icon 20 px + gap 12 px). */}
                <Button type="button" variant="outline" size="sm" className="ml-8" onClick={() => setPasteOpen(true)}>
                  Tempel lowongan lain
                </Button>
              </section>
            ) : (
              <JobPastePanel
                onResult={(r) => {
                  setDraft(r);
                  setVersion((v) => v + 1); // remount the uncontrolled form (and the CV check) with the new draft
                  setPasteOpen(false);
                }}
              />
            )}
          </div>
          {draft && (
            <div className="order-3 lg:order-none">
              <NewApplicationCvCheck key={version} formId={FORM_ID} text={draft.text} resumes={resumes} />
            </div>
          )}
        </div>
      )}
      <div className="order-2 lg:order-none">
        {aiEnabled && !draft && !manual ? (
          <Button type="button" variant="outline" onClick={() => setManual(true)}>
            Isi manual tanpa AI
          </Button>
        ) : (
          <ApplicationForm
            key={version}
            id={FORM_ID}
            action={createApplication}
            stages={stages}
            resumes={resumes}
            defaults={merged}
            evidence={evidence}
            submitLabel="Simpan lamaran"
          >
            {draft && <RequirementsEditor job={draft.job} text={draft.text} profile={profile} />}
          </ApplicationForm>
        )}
      </div>
    </div>
  );
}
