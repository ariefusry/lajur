"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import { createApplication } from "@/actions/applications";
import { ApplicationForm, type ApplicationDefaults, type Evidence } from "@/components/application/application-form";
import { NewApplicationCvCheck } from "@/components/application/cv-check";
import { JobPastePanel, type ExtractResult } from "@/components/application/job-paste-panel";
import { RequirementsEditor } from "@/components/application/requirements-editor";
import { AiConsent } from "@/components/settings/ai-consent";
import { Button } from "@/components/ui/button";

type Props = {
  aiEnabled: boolean;
  aiConsent: boolean;
  stages: { id: string; name: string }[];
  resumes: { id: string; versionName: string }[];
  defaults: ApplicationDefaults;
  profile: React.ComponentProps<typeof RequirementsEditor>["profile"];
};

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
    <div className={aiEnabled ? "grid items-start gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]" : "space-y-6"}>
      {aiEnabled && (
        <div className="lg:sticky lg:top-6">
          {aiConsent ? (
            <JobPastePanel
              onResult={(r) => {
                setDraft(r);
                setVersion((v) => v + 1); // remount the uncontrolled form with the draft values
              }}
            />
          ) : (
            <section className="glass space-y-3 rounded-2xl border p-4">
              <h2 className="flex items-center gap-2 font-medium">
                <Sparkles className="size-4" /> Tambah dengan AI
              </h2>
              <AiConsent consentedAt={null} />
            </section>
          )}
        </div>
      )}
      {aiEnabled && !draft && !manual ? (
        <Button type="button" variant="outline" onClick={() => setManual(true)}>
          Isi manual tanpa AI
        </Button>
      ) : (
        <ApplicationForm
          key={version}
          action={createApplication}
          stages={stages}
          resumes={resumes}
          defaults={merged}
          evidence={evidence}
          submitLabel="Simpan lamaran"
        >
          {draft && (
            <div className="space-y-4">
              <RequirementsEditor job={draft.job} text={draft.text} profile={profile} />
              <NewApplicationCvCheck text={draft.text} resumes={resumes} />
            </div>
          )}
        </ApplicationForm>
      )}
    </div>
  );
}
