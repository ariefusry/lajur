"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { applyTemplate } from "@/actions/settings";
import { ConfirmBar } from "@/components/confirm-bar";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { STAGE_TEMPLATES, type TemplateKey } from "@/lib/stage-templates";

/** One dropdown + "Pakai" (with confirmation). Once applications exist, only a short note remains. */
export function TemplatePicker({ disabled }: { disabled: boolean }) {
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState<TemplateKey>("UMUM");
  const [asking, setAsking] = useState(false);

  if (disabled) {
    return (
      <p className="text-muted-foreground text-xs">
        Template hanya bisa diganti selama belum ada lamaran. Ubah tahap satu per satu di bawah.
      </p>
    );
  }

  function apply() {
    setAsking(false);
    startTransition(async () => {
      const res = await applyTemplate(choice);
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={choice}
          onValueChange={(v) => setChoice(v as TemplateKey)}
          aria-label="Template tahap"
          className="min-w-48 flex-1"
          options={(Object.keys(STAGE_TEMPLATES) as TemplateKey[]).map((key) => ({
            value: key,
            label: `Template ${STAGE_TEMPLATES[key].label}`,
          }))}
        />
        <Button
          type="button"
          variant="outline"
          className="h-10 pointer-coarse:h-11"
          disabled={pending}
          onClick={() => setAsking(true)}
        >
          Pakai
        </Button>
      </div>
      {asking && (
        <ConfirmBar
          destructive={false}
          message={`Ganti semua tahap dengan template ${STAGE_TEMPLATES[choice].label}?`}
          confirmLabel="Ya, ganti"
          disabled={pending}
          onConfirm={apply}
          onCancel={() => setAsking(false)}
        />
      )}
    </div>
  );
}
