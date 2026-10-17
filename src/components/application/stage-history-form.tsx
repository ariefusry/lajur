"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { selectClass } from "@/lib/utils";
import { STAGE_RESULT_LABELS, type FormState } from "@/lib/validation";

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
      <select
        name="result"
        defaultValue={defaults.result}
        className={`${selectClass} w-40`}
        aria-label="Hasil tahap"
      >
        <option value="">Belum ada hasil</option>
        {Object.entries(STAGE_RESULT_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
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
