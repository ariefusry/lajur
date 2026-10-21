"use client";

import { useState } from "react";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatEventWhen, fromDateTimeInput, toDateTimeInput } from "@/lib/dates";
import type { Change } from "@/lib/email-update/plan";
import { optionsFrom, type SelectOption } from "@/lib/utils";
import { EVENT_TYPE_LABELS } from "@/lib/validation";

/** Why a (checked) change can't be applied as edited, or null. Mirrors applyEmailUpdate's checks. */
export function changeError(c: Change): string | null {
  if (c.kind === "event") {
    if (!c.startsAt) return "Isi batas akhirnya.";
    if (c.opensAt && Date.parse(c.opensAt) >= Date.parse(c.startsAt)) return "Waktu mulai harus sebelum batas akhir.";
  }
  if (c.kind === "notes" && !c.text.trim()) return "Catatannya masih kosong.";
  return null;
}

const toIso = (value: string) => (value ? fromDateTimeInput(value).toISOString() : "");
const toInput = (iso: string | null) => (iso ? toDateTimeInput(new Date(iso)) : "");

type Props = {
  change: Change;
  stageOptions: SelectOption[];
  checked: boolean;
  onCheck: (checked: boolean) => void;
  onChange: (change: Change) => void;
};

/** One proposed change: checkbox, the change as a sentence with its quote, and "Ubah" to edit it. */
export function ChangeRow({ change: c, stageOptions, checked, onCheck, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const id = `change-${c.id}`;
  const stage = (stageId: string) => stageOptions.find((s) => s.value === stageId)?.label ?? "tahap lain";
  const error = checked ? changeError(c) : null;

  const sentence =
    c.kind === "move" ? (
      <>
        Pindahkan ke <strong>{stage(c.stageId)}</strong>
      </>
    ) : c.kind === "fail" ? (
      <>
        Tandai tahap <strong>{stage(c.stageId)}</strong> sebagai Gagal
      </>
    ) : c.kind === "event" ? (
      <>
        Tambah jadwal <strong>{EVENT_TYPE_LABELS[c.type]}</strong>
        {!changeError(c) &&
          ` · ${formatEventWhen({ startsAt: new Date(c.startsAt), opensAt: c.opensAt ? new Date(c.opensAt) : null })}`}
      </>
    ) : (
      "Simpan catatan"
    );

  return (
    <li className="flex gap-3 p-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onCheck(e.target.checked)}
        className="accent-primary mt-0.5 size-4 shrink-0"
      />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start gap-2">
          <label htmlFor={id} className="min-w-0 flex-1 text-sm">
            {sentence}
          </label>
          <Button type="button" variant="ghost" size="sm" className="-my-1.5" onClick={() => setEditing(!editing)}>
            {editing ? "Selesai" : "Ubah"}
          </Button>
        </div>
        {c.kind === "event" && c.locationOrUrl && (
          <p className="text-muted-foreground text-xs break-all">{c.locationOrUrl}</p>
        )}
        {c.kind === "notes" && !editing && (
          <p className="text-muted-foreground line-clamp-6 text-xs break-words whitespace-pre-line">{c.text}</p>
        )}
        {c.kind !== "notes" && c.quote && (
          <p className="text-muted-foreground text-xs break-words italic">&ldquo;{c.quote}&rdquo;</p>
        )}

        {editing && (c.kind === "move" || c.kind === "fail") && (
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-stage`}>Tahap</Label>
            <Select
              id={`${id}-stage`}
              options={stageOptions}
              value={c.stageId}
              onValueChange={(stageId) => onChange({ ...c, stageId })}
            />
          </div>
        )}
        {/* Times are uncontrolled: a half-typed datetime-local reports "", which would wipe it if fed back. */}
        {editing && c.kind === "event" && (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-type`}>Jenis</Label>
              <Select
                id={`${id}-type`}
                options={optionsFrom(EVENT_TYPE_LABELS)}
                value={c.type}
                onValueChange={(type) => onChange({ ...c, type: type as typeof c.type })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-opens`}>Mulai bisa dikerjakan</Label>
              <DatePicker
                id={`${id}-opens`}
                withTime
                defaultValue={toInput(c.opensAt)}
                onValueChange={(v) => onChange({ ...c, opensAt: toIso(v) || null })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-closes`}>Batas akhir</Label>
              <DatePicker
                id={`${id}-closes`}
                withTime
                defaultValue={toInput(c.startsAt)}
                onValueChange={(v) => onChange({ ...c, startsAt: toIso(v) })}
              />
            </div>
          </div>
        )}
        {editing && c.kind === "notes" && (
          <Textarea
            aria-label="Catatan"
            rows={6}
            value={c.text}
            onChange={(e) => onChange({ ...c, text: e.target.value })}
          />
        )}
        {error && <p className="text-destructive text-xs">{error}</p>}
      </div>
    </li>
  );
}
