"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { finishOnboarding } from "@/actions/onboarding";
import { applyTemplate } from "@/actions/settings";
import { ResumeUpload } from "@/components/resumes/resume-upload";
import { ProfileForm } from "@/components/settings/profile-form";
import { Button } from "@/components/ui/button";
import { STAGE_TEMPLATES, type TemplateKey } from "@/lib/stage-templates";
import { cn } from "@/lib/utils";

const step = (n: number) => `/mulai?step=${n}`;

export function ProfileStep({ defaults }: { defaults: React.ComponentProps<typeof ProfileForm>["defaults"] }) {
  const router = useRouter();
  // Stable, so the form's "saved" effect fires once.
  const next = useCallback(() => router.push(step(3)), [router]);
  return <ProfileForm defaults={defaults} onSaved={next} />;
}

// Wishlist and the closing stages are the same everywhere; the preview shows what makes each template different.
const preview = (key: TemplateKey) =>
  STAGE_TEMPLATES[key].stages
    .filter((s) => s.kind === "IN_PROGRESS")
    .map((s) => s.name)
    .join(" → ");

export function TemplateStep() {
  const router = useRouter();
  const [choice, setChoice] = useState<TemplateKey>("UMUM");
  const [pending, startTransition] = useTransition();

  function next() {
    startTransition(async () => {
      const res = await applyTemplate(choice);
      // Fails only once applications exist (template locked); the wizard just moves on.
      if (!res.ok) toast.error(res.message);
      router.push(step(4));
    });
  }

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Jenis lamaran" className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(STAGE_TEMPLATES) as TemplateKey[]).map((key) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={choice === key}
            onClick={() => setChoice(key)}
            className={cn(
              "bg-card hover:border-primary/50 focus-visible:ring-ring/50 relative flex flex-col justify-start rounded-xl border p-4 text-left transition-colors outline-none focus-visible:ring-2",
              choice === key && "border-primary ring-primary ring-1",
            )}
          >
            <span className="block pr-6 font-medium">{STAGE_TEMPLATES[key].label}</span>
            <span className="text-muted-foreground mt-1 block text-xs leading-relaxed">{preview(key)}</span>
            {choice === key && <Check className="text-primary absolute top-4 right-4 size-4" aria-hidden />}
          </button>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">Nama dan urutan tahap bisa diubah kapan saja di Pengaturan.</p>
      <div className="flex justify-end">
        <Button type="button" onClick={next} disabled={pending}>
          {pending ? "Menyiapkan…" : "Lanjut"}
        </Button>
      </div>
    </div>
  );
}

export function CvStep() {
  const [pending, startTransition] = useTransition();
  const finish = () => startTransition(() => finishOnboarding());
  return (
    <div className="space-y-4">
      <ResumeUpload onUploaded={finish} />
      <div className="flex justify-end">
        <Button type="button" variant="link" onClick={finish} disabled={pending}>
          Nanti saja
        </Button>
      </div>
    </div>
  );
}
