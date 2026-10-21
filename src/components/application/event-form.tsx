"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EVENT_TYPE_LABELS, type FormState } from "@/lib/validation";
import { Select } from "@/components/ui/select";
import { optionsFrom } from "@/lib/utils";
import { submitKeepingValues } from "@/lib/form";

export function EventForm({
  action,
  defaults = { type: "", startsAt: "", opensAt: "", locationOrUrl: "" },
  submitLabel,
  idPrefix,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaults?: { type: string; startsAt: string; opensAt: string; locationOrUrl: string };
  submitLabel: string;
  idPrefix: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  // Remounting clears every field; form.reset() would miss the ones that keep their own state (Select, DatePicker).
  const [formKey, setFormKey] = useState(0);
  const isCreate = !defaults.startsAt;

  useEffect(() => {
    if (state.ok && state.message) {
      toast.success(state.message);
      if (isCreate) setFormKey((k) => k + 1);
    }
  }, [state, isCreate]);

  const err = (name: string) => state.errors?.[name]?.[0];

  return (
    // Container query: the same form sits in a narrow side card and in a wide list row.
    <div className="@container">
      <form
        key={formKey}
        onSubmit={submitKeepingValues(formAction)}
        className="grid gap-3 @2xl:grid-cols-[9rem_15rem_15rem_1fr_auto] @2xl:items-end"
      >
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-type`}>Jenis</Label>
          <Select
            id={`${idPrefix}-type`}
            name="type"
            defaultValue={defaults.type}
            placeholder="Pilih"
            required
            options={optionsFrom(EVENT_TYPE_LABELS)}
          />
          {err("type") && <p className="text-destructive text-xs">{err("type")}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-opensAt`}>Mulai bisa dikerjakan (opsional)</Label>
          <DatePicker id={`${idPrefix}-opensAt`} name="opensAt" withTime defaultValue={defaults.opensAt} />
          {err("opensAt") && <p className="text-destructive text-xs">{err("opensAt")}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-startsAt`}>Tanggal & jam (WIB) / batas akhir</Label>
          <DatePicker id={`${idPrefix}-startsAt`} name="startsAt" withTime defaultValue={defaults.startsAt} required />
          {err("startsAt") && <p className="text-destructive text-xs">{err("startsAt")}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-loc`}>Lokasi / link</Label>
          <Input
            id={`${idPrefix}-loc`}
            name="locationOrUrl"
            defaultValue={defaults.locationOrUrl}
            placeholder="Zoom, alamat kantor…"
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : submitLabel}
        </Button>
        {state.message && !state.ok && <p className="text-destructive text-sm @2xl:col-span-5">{state.message}</p>}
      </form>
    </div>
  );
}
