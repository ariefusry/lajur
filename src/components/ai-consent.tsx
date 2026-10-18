"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setAiConsent } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/dates";

/**
 * What the AI features send where, and the agree / withdraw button (UU PDP consent). The button shows the
 * action's own result: the page refresh after a server action was seen to get lost now and then (about 1 in 4
 * clicks on a phone-sized screen, Next 15.5), which left the old button on screen.
 */
export function AiConsent({
  consentedAt,
  readOnly = false,
  onChange,
}: {
  consentedAt: string | null; // ISO
  readOnly?: boolean;
  onChange?: (consented: boolean) => void;
}) {
  const router = useRouter();
  const [at, setAt] = useState(consentedAt);
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const result = await setAiConsent(!at);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setAt(result.consentedAt);
      onChange?.(result.consentedAt !== null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">
        Fitur AI (isi otomatis dari lowongan, cek CV, draf follow-up) mengirim teks ke penyedia AI pihak ketiga yang
        servernya di luar Indonesia: Groq, dengan cadangan Cloudflare. Teks lowongan dikirim apa adanya. Dari CV hanya
        bagian keahlian dan pengalaman yang dikirim, dengan nama, kontak, dan alamat diganti tanda.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {at ? (
          <>
            <span>Kamu menyetujui pada {formatDate(new Date(at))}.</span>
            <Button type="button" variant="outline" size="sm" onClick={toggle} disabled={readOnly || pending}>
              {pending ? "Menyimpan…" : "Tarik persetujuan"}
            </Button>
          </>
        ) : (
          <Button type="button" onClick={toggle} disabled={readOnly || pending}>
            {pending ? "Menyimpan…" : "Saya setuju"}
          </Button>
        )}
      </div>
    </div>
  );
}
