import { setAiConsent } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/dates";

/** What the AI features send where, and the agree / withdraw button (UU PDP consent). */
export function AiConsent({ consentedAt, readOnly = false }: { consentedAt: Date | null; readOnly?: boolean }) {
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">
        Fitur AI (isi otomatis dari lowongan, cek skill, saran CV, draf follow-up) mengirim teks ke penyedia AI pihak
        ketiga yang servernya di luar Indonesia: Groq, dengan cadangan Cloudflare. Teks lowongan dikirim apa adanya.
        Dari CV hanya bagian keahlian dan pengalaman yang dikirim, dengan nama, kontak, dan alamat diganti tanda.
      </p>
      <form action={setAiConsent} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="agree" value={consentedAt ? "false" : "true"} />
        {consentedAt ? (
          <>
            <span>Kamu menyetujui pada {formatDate(consentedAt)}.</span>
            <Button type="submit" variant="outline" size="sm" disabled={readOnly}>
              Tarik persetujuan
            </Button>
          </>
        ) : (
          <Button type="submit" disabled={readOnly}>
            Saya setuju
          </Button>
        )}
      </form>
    </div>
  );
}
