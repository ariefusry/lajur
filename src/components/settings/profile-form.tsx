"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { updateProfile } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { submitKeepingValues } from "@/lib/form";

type Defaults = { gpa: string; birthDate: string; major: string; degree: string; domicile: string };

const DEGREES = ["SMA", "D1", "D2", "D3", "D4", "S1", "S2", "S3"] as const;

/**
 * `onSaved` is the /mulai wizard's mode: the fields eligibility checks need become required (IPK and major
 * not for SMA/SMK, which has neither), and saving moves on instead of showing a toast.
 */
export function ProfileForm({ defaults, onSaved }: { defaults: Defaults; onSaved?: () => void }) {
  const [state, action, pending] = useActionState(updateProfile, {});
  const [degree, setDegree] = useState(defaults.degree);
  useEffect(() => {
    if (!state.ok) return;
    if (onSaved) onSaved();
    else if (state.message) toast.success(state.message);
  }, [state, onSaved]);
  const required = !!onSaved;
  const studyRequired = required && degree !== "SMA";

  const err = (name: keyof Defaults) => state.errors?.[name]?.[0];
  const row = (name: keyof Defaults, label: string, input: React.ReactNode) => (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      {input}
      {err(name) && <p className="text-destructive text-xs">{err(name)}</p>}
    </div>
  );

  return (
    <form onSubmit={submitKeepingValues(action)} className="grid gap-4 sm:grid-cols-2">
      {row(
        "gpa",
        "IPK (skala 4.00)",
        <Input
          id="gpa"
          name="gpa"
          inputMode="decimal"
          placeholder="3.45"
          defaultValue={defaults.gpa}
          required={studyRequired}
          aria-invalid={!!err("gpa") || undefined}
        />,
      )}
      {row(
        "birthDate",
        "Tanggal lahir",
        <Input id="birthDate" name="birthDate" type="date" defaultValue={defaults.birthDate} required={required} />,
      )}
      {row(
        "degree",
        "Pendidikan terakhir",
        <Select
          id="degree"
          name="degree"
          defaultValue={defaults.degree}
          onValueChange={setDegree}
          required={required}
          options={[{ value: "", label: "Belum diisi" }, ...DEGREES.map((d) => ({ value: d, label: d }))]}
        />,
      )}
      {row(
        "major",
        "Jurusan",
        <Input
          id="major"
          name="major"
          placeholder="Akuntansi"
          defaultValue={defaults.major}
          required={studyRequired}
        />,
      )}
      {row(
        "domicile",
        "Domisili",
        <Input id="domicile" name="domicile" placeholder="Bekasi" defaultValue={defaults.domicile} />,
      )}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : onSaved ? "Lanjut" : "Simpan profil"}
        </Button>
      </div>
    </form>
  );
}
