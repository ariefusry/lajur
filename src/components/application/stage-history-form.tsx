"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { STAGE_RESULT_LABELS, type FormState } from "@/lib/validation";
import { Select, optionsFrom } from "@/components/ui/select";

export function StageHistoryForm({
  id,
  action,
  defaults,
}: {
  id: string;
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaults: { result: string; notes: string };
}) {
  const [state, formAction, pending] = useActionState(action, {});
  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok && state.message) toast.error(state.message);
  }, [state]);

  return (
    <form action={formAction} className="space-y-2">
      <Select
        name="result"
        defaultValue={defaults.result}
        className="w-44"
        aria-label="Hasil tahap"
        options={[{ value: "", label: "Belum ada hasil" }, ...optionsFrom(STAGE_RESULT_LABELS)]}
      />
      <Textarea
        name="notes"
        id={`notes-${id}`}
        rows={3}
        defaultValue={defaults.notes}
        placeholder="Pertanyaan wawancara, kesan, alasan gagal…"
        aria-label="Catatan tahap"
      />
      {state.errors?.notes && <p className="text-xs text-destructive">{state.errors.notes[0]}</p>}
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Menyimpan…" : "Simpan catatan"}
      </Button>
    </form>
  );
}
