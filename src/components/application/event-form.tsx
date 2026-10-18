"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EVENT_TYPE_LABELS, type FormState } from "@/lib/validation";
import { Select, optionsFrom } from "@/components/ui/select";

export function EventForm({
  action,
  defaults = { type: "", startsAt: "", locationOrUrl: "" },
  submitLabel,
  idPrefix,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaults?: { type: string; startsAt: string; locationOrUrl: string };
  submitLabel: string;
  idPrefix: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const isCreate = !defaults.startsAt;

  useEffect(() => {
    if (state.ok && state.message) {
      toast.success(state.message);
      if (isCreate) formRef.current?.reset();
    }
  }, [state, isCreate]);

  const err = (name: string) => state.errors?.[name]?.[0];

  return (
    <form ref={formRef} action={formAction} className="grid gap-3 sm:grid-cols-[10rem_14rem_1fr_auto] sm:items-end">
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
        {err("type") && <p className="text-xs text-destructive">{err("type")}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-startsAt`}>Tanggal & jam (WIB)</Label>
        <Input id={`${idPrefix}-startsAt`} name="startsAt" type="datetime-local" defaultValue={defaults.startsAt} required />
        {err("startsAt") && <p className="text-xs text-destructive">{err("startsAt")}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-loc`}>Lokasi / link</Label>
        <Input id={`${idPrefix}-loc`} name="locationOrUrl" defaultValue={defaults.locationOrUrl} placeholder="Zoom, alamat kantor…" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan…" : submitLabel}
      </Button>
      {state.message && !state.ok && <p className="text-sm text-destructive sm:col-span-4">{state.message}</p>}
    </form>
  );
}
