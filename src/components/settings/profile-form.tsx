"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { updateProfile } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type Defaults = { gpa: string; birthDate: string; major: string; degree: string; domicile: string };

const DEGREES = ["SMA", "D1", "D2", "D3", "D4", "S1", "S2", "S3"] as const;

export function ProfileForm({ defaults }: { defaults: Defaults }) {
  const [state, action, pending] = useActionState(updateProfile, {});
  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
  }, [state]);

  const err = (name: keyof Defaults) => state.errors?.[name]?.[0];
  const row = (name: keyof Defaults, label: string, input: React.ReactNode) => (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      {input}
      {err(name) && <p className="text-destructive text-xs">{err(name)}</p>}
    </div>
  );

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {row(
        "gpa",
        "IPK (skala 4.00)",
        <Input
          id="gpa"
          name="gpa"
          inputMode="decimal"
          placeholder="3.45"
          defaultValue={defaults.gpa}
          aria-invalid={!!err("gpa") || undefined}
        />,
      )}
      {row(
        "birthDate",
        "Tanggal lahir",
        <Input id="birthDate" name="birthDate" type="date" defaultValue={defaults.birthDate} />,
      )}
      {row(
        "degree",
        "Pendidikan terakhir",
        <Select
          id="degree"
          name="degree"
          defaultValue={defaults.degree}
          options={[{ value: "", label: "Belum diisi" }, ...DEGREES.map((d) => ({ value: d, label: d }))]}
        />,
      )}
      {row("major", "Jurusan", <Input id="major" name="major" placeholder="Akuntansi" defaultValue={defaults.major} />)}
      {row(
        "domicile",
        "Domisili",
        <Input id="domicile" name="domicile" placeholder="Bekasi" defaultValue={defaults.domicile} />,
      )}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan profil"}
        </Button>
      </div>
    </form>
  );
}
