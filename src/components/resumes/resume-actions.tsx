"use client";

import { ExternalLink, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteResume, getResumeUrl } from "@/actions/resumes";
import { ConfirmBar } from "@/components/confirm-bar";
import { Button } from "@/components/ui/button";

export function ViewResumeButton({ id, label = "Lihat" }: { id: string; label?: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        // Open synchronously so the popup blocker allows it, then point it at the 60 s URL.
        const tab = window.open("", "_blank");
        startTransition(async () => {
          const { url, error } = await getResumeUrl(id);
          if (url && tab) tab.location.href = url;
          else {
            tab?.close();
            toast.error(error ?? "Gagal membuka CV.");
          }
        });
      }}
    >
      <ExternalLink /> {label}
    </Button>
  );
}

export function DeleteResumeButton({ id, name, usedBy }: { id: string; name: string; usedBy: number }) {
  const [pending, startTransition] = useTransition();
  const [asking, setAsking] = useState(false);
  if (asking) {
    const warn = usedBy ? ` CV ini tertaut ke ${usedBy} lamaran; tautannya akan dilepas.` : "";
    return (
      <ConfirmBar
        className="w-full"
        message={`Hapus "${name}"?${warn}`}
        confirmLabel="Ya, hapus"
        disabled={pending}
        onConfirm={() => startTransition(() => deleteResume(id))}
        onCancel={() => setAsking(false)}
      />
    );
  }
  return (
    <Button variant="ghost" size="icon-sm" aria-label={`Hapus ${name}`} onClick={() => setAsking(true)}>
      <Trash2 />
    </Button>
  );
}
