"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AiConsent } from "@/components/ai-consent";
import { EmailAiNotice } from "@/components/email-update/email-ai-notice";
import { ReviewList, type EmailUpdateResult } from "@/components/email-update/review-list";
import { Label } from "@/components/ui/label";
import { ShinyButton } from "@/components/ui/shiny-button";
import { Textarea } from "@/components/ui/textarea";

type Props = { consentedAt: string | null; noticed: boolean; aiEnabled: boolean; readOnly: boolean };

/** Paste box → AI reading → review list. Gates: AI consent, then the one-time email notice, then AI availability. */
export function EmailUpdate({ consentedAt, noticed, aiEnabled, readOnly }: Props) {
  // Local, so agreeing or acknowledging shows the next step right away (see AiConsent).
  const [consented, setConsented] = useState(!!consentedAt);
  const [acknowledged, setAcknowledged] = useState(noticed);
  const [text, setText] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<EmailUpdateResult | null>(null);

  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  async function read() {
    if (text.trim().length < 30) return toast.error("Tempel isi email dari perusahaan (minimal 30 karakter).");
    setStartedAt(Date.now());
    setElapsed(0);
    try {
      const res = await fetch("/api/ai/email-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return toast.error(body.error ?? "AI sedang tidak tersedia, silakan isi manual.");
      setResult(body as EmailUpdateResult);
    } catch {
      toast.error("Koneksi gagal. Silakan coba lagi.");
    } finally {
      setStartedAt(null);
    }
  }

  if (!consented) {
    return (
      <section className="glass space-y-3 rounded-2xl border p-4">
        <h2 className="flex items-center gap-2 font-medium">
          <Sparkles className="size-4" /> Baca email dengan AI
        </h2>
        {/* Agreeing to the current wording also marks the email notice as read (setAiConsent). */}
        <AiConsent
          consentedAt={consentedAt}
          readOnly={readOnly}
          onChange={(agreed) => {
            setConsented(agreed);
            if (agreed) setAcknowledged(true);
          }}
        />
      </section>
    );
  }
  if (!acknowledged) {
    return (
      <section className="glass space-y-3 rounded-2xl border p-4">
        <h2 className="font-medium">Sebelum mulai</h2>
        <EmailAiNotice onDone={() => setAcknowledged(true)} />
      </section>
    );
  }
  if (!aiEnabled) {
    return (
      <p className="text-sm">
        AI sedang tidak tersedia. Kamu tetap bisa memperbarui lamaran secara manual di halamannya.
      </p>
    );
  }
  if (result) return <ReviewList result={result} onCancel={() => setResult(null)} />;

  const pending = startedAt !== null;
  return (
    <section className="glass space-y-3 rounded-2xl border p-4">
      <div className="space-y-1.5">
        <Label htmlFor="email-text">Isi email</Label>
        <p className="text-muted-foreground text-sm">
          Salin seluruh isi email, termasuk nama perusahaan, tanggal dan jam, link, dan info login kalau ada. Bagian
          yang tidak ikut disalin tidak bisa dibaca AI.
        </p>
        <Textarea
          id="email-text"
          rows={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="max-h-[60svh] min-h-40"
          disabled={pending}
        />
        <p className="text-muted-foreground text-xs">Nama, kontak, dan kredensial disamarkan sebelum dikirim ke AI.</p>
      </div>
      <ShinyButton onClick={read} disabled={pending}>
        <Sparkles /> {pending ? `Membaca email… (${elapsed}s)` : "Baca dengan AI"}
      </ShinyButton>
    </section>
  );
}
