"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { EligibilityBadge } from "@/components/eligibility-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RequirementType } from "@/generated/prisma/enums";
import type { ExtractedJob } from "@/lib/ai/extract-job";
import { checkRequirement, type EligibilityProfile } from "@/lib/eligibility/check";
import { selectClass } from "@/lib/utils";
import { REQUIREMENT_TYPE_LABELS, type Draft } from "@/lib/validation";

type Row = Draft["requirements"][number] & { key: number; original: { type: RequirementType; value: string } };

/** Review step for AI-extracted requirements; serializes the result into the form's hidden "draft" field. */
export function RequirementsEditor({
  job,
  text,
  profile,
}: {
  job: ExtractedJob;
  text: string;
  profile: { gpa: number | null; birthDate: string | null; major: string | null; degree: EligibilityProfile["degree"] };
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    job.requirements.map((r, key) => ({
      key,
      type: r.type,
      value: r.value,
      sourceQuote: r.quote,
      ageReferenceDate: r.ageReferenceDate,
      editedByUser: false,
      original: { type: r.type, value: r.value },
    })),
  );
  const eligibilityProfile: EligibilityProfile = {
    ...profile,
    birthDate: profile.birthDate ? new Date(profile.birthDate) : null,
  };
  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) =>
      rs.map((r) => {
        if (r.key !== key) return r;
        const next = { ...r, ...patch };
        return { ...next, editedByUser: next.type !== r.original.type || next.value !== r.original.value };
      }),
    );

  const draft: Draft = {
    jobPostingText: text,
    requirements: rows.map(({ type, value, sourceQuote, ageReferenceDate, editedByUser }) => ({
      type, value, sourceQuote, ageReferenceDate, editedByUser,
    })),
  };

  return (
    <div className="space-y-4">
      <input type="hidden" name="draft" value={JSON.stringify(draft)} />

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Syarat dari lowongan</h3>
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">Tidak ada syarat administratif yang ditemukan.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => {
              const check = checkRequirement(
                { type: r.type, value: r.value, ageReferenceDate: r.ageReferenceDate ? new Date(`${r.ageReferenceDate}T00:00:00Z`) : null },
                eligibilityProfile,
                new Date(),
              );
              return (
                <li key={r.key} className="space-y-1.5 rounded-lg border bg-card p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={r.type}
                      onChange={(e) => update(r.key, { type: e.target.value as RequirementType })}
                      className={`${selectClass} w-40`}
                      aria-label="Jenis syarat"
                    >
                      {Object.entries(REQUIREMENT_TYPE_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                    <Input
                      value={r.value}
                      onChange={(e) => update(r.key, { value: e.target.value })}
                      className="min-w-32 flex-1"
                      aria-label="Nilai syarat"
                      maxLength={200}
                    />
                    <EligibilityBadge status={check.status} title={check.reason} />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Hapus syarat"
                      onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                    >
                      <X />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Bukti: <q className="italic">{r.sourceQuote}</q>
                    {r.ageReferenceDate && ` · usia dihitung per ${r.ageReferenceDate}`}
                  </p>
                  <p className="text-xs">{check.reason}</p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {job.skills.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Skill yang diminta</h3>
          <div className="flex flex-wrap gap-1.5">
            {job.skills.map((s) => (
              <Badge key={s.name} variant="outline" title={`Bukti: "${s.quote}"`}>
                {s.name}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Setelah disimpan, cocokkan skill ini dengan CV-mu di halaman detail lamaran.</p>
        </div>
      )}
    </div>
  );
}
