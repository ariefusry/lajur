"use client";

import { useState } from "react";
import { createApplication } from "@/actions/applications";
import { ApplicationForm, type ApplicationDefaults, type Evidence } from "@/components/application/application-form";
import { JobPastePanel, type ExtractResult } from "@/components/application/job-paste-panel";
import { RequirementsEditor } from "@/components/application/requirements-editor";
import { Button } from "@/components/ui/button";

type Props = {
  aiEnabled: boolean;
  stages: { id: string; name: string }[];
  resumes: { id: string; versionName: string }[];
  defaults: ApplicationDefaults;
  profile: React.ComponentProps<typeof RequirementsEditor>["profile"];
};

export function NewApplication({ aiEnabled, stages, resumes, defaults, profile }: Props) {
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
        url: draft.sourceUrl ?? defaults.url,
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
          <JobPastePanel
            onResult={(r) => {
              setDraft(r);
              setVersion((v) => v + 1); // remount the uncontrolled form with the draft values
            }}
          />
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
          {draft && <RequirementsEditor job={draft.job} text={draft.text} profile={profile} />}
        </ApplicationForm>
      )}
    </div>
  );
}
