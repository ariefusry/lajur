"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { applyTemplate } from "@/actions/settings";
import { ConfirmBar } from "@/components/confirm-bar";
import { Button } from "@/components/ui/button";
import { STAGE_TEMPLATES, type TemplateKey } from "@/lib/stage-templates";

export function TemplatePicker({ disabled }: { disabled: boolean }) {
  const [pending, startTransition] = useTransition();

  const [asking, setAsking] = useState<TemplateKey | null>(null);

  function pick(key: TemplateKey) {
    setAsking(null);
    startTransition(async () => {
      const res = await applyTemplate(key);
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(STAGE_TEMPLATES) as TemplateKey[]).map((key) => (
          <Button key={key} variant="outline" disabled={disabled || pending} onClick={() => setAsking(key)}>
            Pakai template {STAGE_TEMPLATES[key].label}
          </Button>
        ))}
      </div>
      {asking && (
        <ConfirmBar
          destructive={false}
          message={`Ganti semua tahap dengan template ${STAGE_TEMPLATES[asking].label}?`}
          confirmLabel="Ya, ganti"
          disabled={pending}
          onConfirm={() => pick(asking)}
          onCancel={() => setAsking(null)}
        />
      )}
      {disabled && (
        <p className="text-xs text-muted-foreground">
          Template hanya bisa diganti selama belum ada lamaran. Ubah tahap satu per satu di bawah.
        </p>
      )}
    </div>
  );
}
