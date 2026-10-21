import { z } from "zod";
import { AiConsentRequiredError } from "@/lib/ai/consent";
import type { ExtractEvent } from "@/lib/ai/extract-events";
import { normalizeJobText } from "@/lib/ai/extract-job";
import { extractJob, NothingFoundError } from "@/lib/ai/extract-job.server";
import { fetchJobPageText, FetchPageError } from "@/lib/ai/fetch-page";
import { parseImageDataUrl } from "@/lib/ai/poster";
import { aiEnabled, AiUnavailableError, transcribeImage, visionEnabled } from "@/lib/ai/provider";
import { QuotaExceededError } from "@/lib/ai/usage";
import { auth } from "@/lib/auth";
import { DEMO_READ_ONLY_MESSAGE, isReadOnly } from "@/lib/demo";

export const runtime = "nodejs";
// Per model: first try + retry (≤30 s each), up to 3 models; a poster adds one try per vision model first.
export const maxDuration = 260;

const Body = z
  .object({
    text: z.string().max(100_000).optional(),
    url: z.url().optional(),
    image: z.string().max(4_100_000).optional(), // data URL of a poster; it wins over text and url
  })
  .refine((b) => b.image || b.text?.trim() || b.url, "Tempel teks lowongan, link, atau gambar posternya.");

const fail = (error: string, status: number) => Response.json({ error }, { status });

/**
 * Responds with NDJSON (one ExtractEvent per line) so the form can show which step the AI is on.
 * Auth and input errors are plain JSON with an HTTP status, before the stream starts.
 */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("Silakan masuk dulu.", 401);
  if (isReadOnly({ email: session.user?.email ?? null })) return fail(DEMO_READ_ONLY_MESSAGE, 403);
  if (!aiEnabled()) return fail("AI sedang tidak tersedia, silakan isi manual.", 503);

  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail(body.error.issues[0]?.message ?? "Permintaan tidak valid.", 400);
  const image = body.data.image ? parseImageDataUrl(body.data.image) : null;
  if (body.data.image && !image) return fail("Gambar harus JPG, PNG, atau WebP, maksimal 3 MB.", 422);
  if (image && !visionEnabled())
    return fail("Membaca gambar sedang tidak tersedia. Tempel teks lowongannya saja.", 503);
  const pasted = image ? "" : (body.data.text?.trim() ?? "");
  if (pasted && normalizeJobText(pasted).length < 50) {
    return fail("Teks lowongan terlalu pendek. Salin isi lowongannya lengkap.", 422);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: ExtractEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        let raw = pasted;
        if (image) {
          send({ type: "status", status: "transcribing" });
          raw = await transcribeImage({ image: image.bytes, mediaType: image.mediaType, userId });
          if (normalizeJobText(raw).length < 50) {
            send({
              type: "error",
              status: 422,
              error:
                "Tidak ada teks lowongan yang terbaca di gambar ini. Coba gambar yang lebih jelas, atau tempel teksnya.",
            });
            return;
          }
        } else if (!raw) {
          send({ type: "status", status: "fetching" });
          raw = await fetchJobPageText(body.data.url!);
        }
        const text = normalizeJobText(raw);
        if (text.length < 50) throw new FetchPageError("Teks lowongan terlalu pendek. Salin isi lowongannya lengkap.");

        const { job, cached } = await extractJob(text, userId, {
          onProgress: (e) => {
            if (e.kind === "attempt")
              send({ type: "status", status: e.fallback ? "fallback" : e.thinking ? "retrying" : "reading" });
          },
          onVerifying: () => send({ type: "status", status: "verifying" }),
        });
        send({ type: "result", job, text, cached });
      } catch (error) {
        if (error instanceof AiConsentRequiredError) send({ type: "error", status: 403, error: error.message });
        else if (error instanceof QuotaExceededError) send({ type: "error", status: 429, error: error.message });
        else if (error instanceof FetchPageError) send({ type: "error", status: 422, error: error.message });
        else if (error instanceof NothingFoundError) {
          send({
            type: "error",
            status: 422,
            error: image
              ? "AI tidak menemukan informasi lowongan di gambar ini. Pastikan gambarnya poster lowongan."
              : pasted
                ? "AI tidak menemukan informasi lowongan di teks ini. Pastikan yang ditempel adalah isi lowongannya."
                : "AI tidak menemukan informasi lowongan di halaman ini. Situsnya mungkin butuh JavaScript atau login, jadi salin teks lowongannya saja.",
          });
        } else {
          if (!(error instanceof AiUnavailableError))
            console.error("ai extract failed", error instanceof Error ? error.name : "unknown");
          send({ type: "error", status: 503, error: "AI sedang tidak tersedia, silakan isi manual." });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
