"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { applyEmailUpdate } from "@/actions/email-update";
import { ChangeRow, changeError } from "@/components/email-update/change-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { EventType, JobSource, StageKind, StageResult } from "@/generated/prisma/enums";
import { planEmailUpdate, type Change } from "@/lib/email-update/plan";
import type { EmailReading } from "@/lib/email-update/reading";
import { optionsFrom } from "@/lib/utils";
import { JOB_SOURCE_LABELS } from "@/lib/validation";

type Candidate = {
  id: string;
  company: string;
  position: string;
  currentStageId: string;
  history: { stageId: string; result: StageResult | null }[];
  events: { type: EventType; startsAt: string; opensAt: string | null }[]; // ISO
};

/** The 200 response of POST /api/ai/email-update. */
export type EmailUpdateResult = {
  reading: EmailReading;
  candidates: Candidate[];
  stages: { id: string; name: string; order: number; kind: StageKind }[];
  matchedId: string | null;
  changes: Change[];
};

/** Re-plans on the client for another candidate (or a new application when `appId` is null); no second AI call. */
function replan(result: EmailUpdateResult, appId: string | null) {
  const app = result.candidates.find((a) => a.id === appId);
  return planEmailUpdate(result.reading, {
    stages: result.stages,
    app: app
      ? {
          ...app,
          events: app.events.map((e) => ({
            type: e.type,
            startsAt: new Date(e.startsAt),
            opensAt: e.opensAt ? new Date(e.opensAt) : null,
          })),
        }
      : null,
  });
}

/** What the email proposes, as rows to check and edit; nothing is saved before "Terapkan". */
export function ReviewList({ result, onCancel }: { result: EmailUpdateResult; onCancel: () => void }) {
  const router = useRouter();
  const { reading, candidates, stages } = result;
  const [appId, setAppId] = useState(result.matchedId);
  const [changes, setChanges] = useState(result.changes);
  const [checked, setChecked] = useState(() => new Set(result.changes.map((c) => c.id)));
  const [newApp, setNewApp] = useState({
    company: reading.company ?? "",
    position: reading.position ?? "",
    source: "",
    url: reading.sourceUrl ?? "",
  });
  const [pending, startTransition] = useTransition();

  const app = candidates.find((a) => a.id === appId);
  const selected = changes.filter((c) => checked.has(c.id));
  const count = selected.length + (app ? 0 : 1); // a new application counts as a change
  const ready =
    selected.every((c) => !changeError(c)) &&
    (!!app || (!!newApp.company.trim() && !!newApp.position.trim() && !!newApp.source));
  const stageOptions = stages.map((s) => ({ value: s.id, label: s.name }));

  function pick(id: string) {
    const next = replan(result, id || null);
    setAppId(id || null);
    setChanges(next);
    setChecked(new Set(next.map((c) => c.id)));
  }

  function apply() {
    startTransition(async () => {
      const res = await applyEmailUpdate({
        applicationId: app?.id ?? null,
        newApplication: app
          ? null
          : {
              company: newApp.company.trim(),
              position: newApp.position.trim(),
              source: newApp.source as JobSource,
              url: newApp.url.trim() || null,
            },
        changes: selected,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Lamaran diperbarui.");
      router.push(`/applications/${res.applicationId}?tab=riwayat`);
    });
  }

  const field = (key: keyof typeof newApp) => ({
    id: `new-${key}`,
    value: newApp[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setNewApp({ ...newApp, [key]: e.target.value }),
  });

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        {app ? (
          <h2 className="min-w-0 font-medium break-words">
            {app.company} · {app.position}
          </h2>
        ) : (
          <p className="min-w-0 text-sm">
            {reading.company ? (
              <>
                Lamaran ke <strong>{reading.company}</strong> belum ada di Lajur.
              </>
            ) : (
              "Lamaran ini belum ada di Lajur."
            )}
          </p>
        )}
        <div className="w-full space-y-1.5 sm:w-64">
          <Label htmlFor="candidate">Bukan yang ini?</Label>
          <Select
            id="candidate"
            value={appId ?? ""}
            onValueChange={pick}
            options={[
              { value: "", label: "Belum ada di Lajur (tambah baru)" },
              ...candidates.map((a) => ({ value: a.id, label: `${a.company} · ${a.position}` })),
            ]}
          />
        </div>
      </div>

      <ul className="bg-card divide-y rounded-xl border">
        {!app && (
          <li className="space-y-3 p-3">
            <p className="text-sm font-medium">Tambahkan ke lamaran</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="new-company">Perusahaan *</Label>
                <Input {...field("company")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-position">Posisi *</Label>
                <Input {...field("position")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-source">Sumber lowongan *</Label>
                <Select
                  id="new-source"
                  value={newApp.source}
                  onValueChange={(source) => setNewApp({ ...newApp, source })}
                  placeholder="Pilih"
                  options={optionsFrom(JOB_SOURCE_LABELS)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-url">Link lowongan</Label>
                <Input type="url" placeholder="https://…" {...field("url")} />
              </div>
            </div>
          </li>
        )}
        {changes.map((c) => (
          <ChangeRow
            // Remount per candidate, so open editors don't keep the previous plan's values.
            key={`${appId}-${c.id}`}
            change={c}
            stageOptions={stageOptions}
            checked={checked.has(c.id)}
            onCheck={(on) => {
              const next = new Set(checked);
              if (on) next.add(c.id);
              else next.delete(c.id);
              setChecked(next);
            }}
            onChange={(edited) => setChanges(changes.map((x) => (x.id === edited.id ? edited : x)))}
          />
        ))}
        {app && changes.length === 0 && (
          <li className="text-muted-foreground p-3 text-sm">Tidak ada yang perlu diubah di lamaran ini.</li>
        )}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={apply} disabled={pending || count === 0 || !ready}>
          {pending ? "Menerapkan…" : `Terapkan ${count} perubahan`}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Batal
        </Button>
      </div>
    </section>
  );
}
