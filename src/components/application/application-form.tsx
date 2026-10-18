"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { JobSource } from "@/generated/prisma/enums";
import { selectClass } from "@/lib/utils";
import { JOB_SOURCE_LABELS, type FormState } from "@/lib/validation";

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
  action,
  stages,
  resumes,
  defaults,
  submitLabel,
  evidence,
  children,
}: {
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
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      {input}
      {evidence && name in evidence && defaults[name] && (
        <p className="text-xs text-muted-foreground">
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
        <p id={`${name}-error`} className="text-xs text-destructive">
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

  return (
    <form action={formAction} className="grid max-w-3xl gap-4 sm:grid-cols-2">
      {field("company", "Perusahaan *", <Input {...a11y("company")} defaultValue={defaults.company} required />)}
      {field("position", "Posisi *", <Input {...a11y("position")} defaultValue={defaults.position} required />)}
      {field(
        "source",
        "Sumber lowongan *",
        <select {...a11y("source")} defaultValue={defaults.source} className={selectClass} required>
          <option value="" disabled>
            Pilih sumber
          </option>
          {Object.entries(JOB_SOURCE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>,
      )}
      {field(
        "currentStageId",
        "Tahap *",
        <select {...a11y("currentStageId")} defaultValue={defaults.currentStageId} className={selectClass} required>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>,
      )}
      {field(
        "resumeId",
        "CV yang dikirim",
        <select {...a11y("resumeId")} defaultValue={defaults.resumeId} className={selectClass}>
          <option value="">{resumes.length ? "Belum dipilih" : "Belum ada CV (unggah di menu CV)"}</option>
          {resumes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.versionName}
            </option>
          ))}
        </select>,
      )}
      {field("location", "Lokasi / penempatan", <Input {...a11y("location")} defaultValue={defaults.location} />)}
      {field(
        "url",
        "Link lowongan",
        <Input {...a11y("url")} type="url" placeholder="https://" defaultValue={defaults.url} />,
      )}
      {field("deadline", "Deadline pendaftaran", <Input {...a11y("deadline")} type="date" defaultValue={defaults.deadline} />)}
      {field("appliedAt", "Tanggal melamar", <Input {...a11y("appliedAt")} type="date" defaultValue={defaults.appliedAt} />)}
      {field(
        "expectedSalary",
        "Gaji yang diharapkan (Rp/bulan)",
        <Input {...a11y("expectedSalary")} inputMode="numeric" placeholder="8000000" defaultValue={defaults.expectedSalary} />,
      )}
      <div className="sm:col-span-2">
        {field("notes", "Catatan", <Textarea {...a11y("notes")} rows={4} defaultValue={defaults.notes} />)}
      </div>
      {children && <div className="sm:col-span-2">{children}</div>}
      {state.message && !state.ok && <p className="text-sm text-destructive sm:col-span-2">{state.message}</p>}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
