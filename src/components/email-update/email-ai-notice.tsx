"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { acknowledgeEmailNotice } from "@/actions/settings";
import { Button } from "@/components/ui/button";

/** One-time notice for users who agreed to AI before "update dari email" existed. */
export function EmailAiNotice({ onDone }: { onDone: () => void }) {
  const [pending, startTransition] = useTransition();

  function acknowledge() {
    startTransition(async () => {
      const result = await acknowledgeEmailNotice();
      if (!result.ok) {
        toast.error(result.message ?? "Gagal menyimpan. Coba lagi.");
        return;
      }
      onDone();
    });
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">
        Fitur ini mengirim isi email yang kamu tempel ke penyedia AI pihak ketiga (Groq, dengan cadangan Cloudflare).
        Sebelum dikirim, nama, kontak, kode peserta, serta username dan password diganti tanda. Info login yang
        ditemukan disimpan di catatan lamaranmu, bukan di AI.
      </p>
      <Button type="button" onClick={acknowledge} disabled={pending}>
        {pending ? "Menyimpan…" : "Saya mengerti"}
      </Button>
    </div>
  );
}
