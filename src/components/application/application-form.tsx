"use client";

import { cn } from "@/lib/utils";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { JobSource } from "@/generated/prisma/enums";
import { JOB_SOURCE_LABELS, type FormState } from "@/lib/validation";
import { Select } from "@/components/ui/select";
import { optionsFrom } from "@/lib/utils";

export type ApplicationDefaults = {
  company: string;
  position: string;
  source: JobSource | "";
  currentStageId: string;
  resumeId: string;
  url: string;
  location: string;
  deadline: string; // YYYY-MM-DD
  appliedAt: string;
  expectedSalary: string;
  notes: string;
};

/** Quotes from the job posting shown under AI-filled fields; null = value without verifiable evidence. */
export type Evidence = Partial<Record<keyof ApplicationDefaults, string | null>>;

export function ApplicationForm({
  id,
  action,
  stages,
  resumes,
  defaults,
  submitLabel,
  evidence,
  children,
}: {
  /** Lets fields outside the form (the "Cek CV" result) join it via the `form` attribute. */
  id?: string;
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  stages: { id: string; name: string }[];
  resumes: { id: string; versionName: string }[];
  defaults: ApplicationDefaults;
  submitLabel: string;
  evidence?: Evidence;
  children?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const err = (name: keyof ApplicationDefaults) => state.errors?.[name]?.[0];

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
  }, [state]);

  const field = (name: keyof ApplicationDefaults, label: string, input: React.ReactNode) => (
    <div className="relative space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      {input}
      {evidence && name in evidence && defaults[name] && (
        <p className="text-muted-foreground text-xs">
          {evidence[name] ? (
            <>
              Bukti: <q className="italic">{evidence[name]}</q>
            </>
          ) : (
            <span className="text-amber-700 dark:text-amber-400">Tanpa kutipan dari lowongan, cek manual.</span>
          )}
        </p>
      )}
      {err(name) && (
        <p id={`${name}-error`} className="text-destructive text-xs">
          {err(name)}
        </p>
      )}
    </div>
  );
  const a11y = (name: keyof ApplicationDefaults) => ({
    id: name,
    name,
    "aria-invalid": !!err(name) || undefined,
    "aria-describedby": err(name) ? `${name}-error` : undefined,
  });

  const span = "sm:col-span-2";

  return (
    <form id={id} action={formAction} className="grid max-w-3xl gap-4 sm:grid-cols-2">
      {field("company", "Perusahaan *", <Input {...a11y("company")} defaultValue={defaults.company} required />)}
      {field("position", "Posisi *", <Input {...a11y("position")} defaultValue={defaults.position} required />)}
      {field(
        "source",
        "Sumber lowongan *",
        <Select
          {...a11y("source")}
          defaultValue={defaults.source}
          placeholder="Pilih sumber"
          required
          options={optionsFrom(JOB_SOURCE_LABELS)}
        />,
      )}
      {field(
        "currentStageId",
        "Tahap *",
        <Select
          {...a11y("currentStageId")}
          defaultValue={defaults.currentStageId}
          required
          options={stages.map((s) => ({ value: s.id, label: s.name }))}
        />,
      )}
      {field(
        "resumeId",
        "CV yang dikirim",
        <Select
          {...a11y("resumeId")}
          defaultValue={defaults.resumeId}
          options={[
            { value: "", label: resumes.length ? "Belum dipilih" : "Belum ada CV (unggah di menu CV)" },
            ...resumes.map((r) => ({ value: r.id, label: r.versionName })),
          ]}
        />,
      )}
      {field("location", "Lokasi / penempatan", <Input {...a11y("location")} defaultValue={defaults.location} />)}
      {field(
        "url",
        "Link lowongan",
        <Input {...a11y("url")} type="url" placeholder="https://" defaultValue={defaults.url} />,
      )}
      {field(
        "deadline",
        "Deadline pendaftaran",
        <Input {...a11y("deadline")} type="date" defaultValue={defaults.deadline} />,
      )}
      {field(
        "appliedAt",
        "Tanggal melamar",
        <Input {...a11y("appliedAt")} type="date" defaultValue={defaults.appliedAt} />,
      )}
      {field(
        "expectedSalary",
        "Gaji yang diharapkan (Rp/bulan)",
        <Input
          {...a11y("expectedSalary")}
          inputMode="numeric"
          placeholder="8000000"
          defaultValue={defaults.expectedSalary}
        />,
      )}
      <div className={span}>
        {field("notes", "Catatan", <Textarea {...a11y("notes")} rows={4} defaultValue={defaults.notes} />)}
      </div>
      {children && <div className={span}>{children}</div>}
      {state.message && !state.ok && <p className={cn("text-destructive text-sm", span)}>{state.message}</p>}
      <div className={span}>
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
