"use client";

import { ImagePlus, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ExtractProgress } from "@/components/application/extract-progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ExtractEvent } from "@/lib/ai/extract-events";
import type { ExtractedJob } from "@/lib/ai/extract-job";
import { ShinyButton } from "@/components/ui/shiny-button";
import { cn } from "@/lib/utils";

export type ExtractResult = { job: ExtractedJob; text: string; cached: boolean; sourceUrl?: string };
type Status = Extract<ExtractEvent, { type: "status" }>["status"];

/** Reads the NDJSON stream from /api/ai/extract line by line. */
async function* readEvents(res: Response): AsyncGenerator<ExtractEvent> {
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop()!;
    for (const line of lines) if (line.trim()) yield JSON.parse(line) as ExtractEvent;
  }
}

/**
 * Re-encodes a poster as JPEG of at most ~4 megapixels: small enough for Vercel's 4.5 MB request cap, sharp enough
 * for small print, and a tall screenshot keeps its width instead of being squeezed by a longest-side cap.
 */
async function posterDataUrl(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, Math.sqrt(4_000_000 / (bitmap.width * bitmap.height)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; // transparent PNGs would turn black in JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function JobPastePanel({
  onResult,
  imageEnabled,
  quota,
}: {
  onResult: (r: ExtractResult) => void;
  imageEnabled: boolean;
  quota: { used: number; limit: number };
}) {
  const router = useRouter();
  // Counted down right away after an AI answer (a cache hit is free); the server's count replaces it on refresh.
  const [left, setLeft] = useState(Math.max(0, quota.limit - quota.used));
  useEffect(() => setLeft(Math.max(0, quota.limit - quota.used)), [quota.limit, quota.used]);
  const [text, setText] = useState("");
  const [image, setImage] = useState<{ name: string; dataUrl: string } | null>(null);
  const [url, setUrl] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState<Status>("reading");

  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  async function pickImage(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Pilih file gambar (JPG, PNG, atau WebP).");
    try {
      setImage({ name: file.name || "Gambar dari clipboard", dataUrl: await posterDataUrl(file) });
    } catch {
      toast.error("Gambar ini tidak bisa dibuka. Coba simpan ulang sebagai JPG atau PNG.");
    }
  }

  async function extract() {
    if (!image && !text.trim() && !url.trim()) return toast.error("Tempel teks lowongan, link, atau gambarnya dulu.");
    setStartedAt(Date.now());
    setElapsed(0);
    setStatus(image ? "transcribing" : text.trim() ? "reading" : "fetching");
    try {
      const res = await fetch("/api/ai/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(image ? { image: image.dataUrl } : text.trim() ? { text } : { url: url.trim() }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        return toast.error(body.error ?? "AI sedang tidak tersedia, silakan isi manual.");
      }
      for await (const event of readEvents(res)) {
        if (event.type === "status") {
          setStatus(event.status);
        } else if (event.type === "result") {
          if (!event.cached) {
            setLeft((n) => Math.max(0, n - 1));
            router.refresh(); // the server's count, for when the panel opens again
          }
          onResult({ ...event, sourceUrl: url.trim() || undefined });
          toast.success(event.cached ? "Draf diisi (dari cache)." : "Draf diisi. Tinjau dulu sebelum menyimpan.");
          return;
        } else {
          if (event.status === 429) setLeft(0);
          toast.error(event.error);
          return;
        }
      }
      toast.error("Koneksi terputus. Silakan coba lagi atau isi manual.");
    } catch {
      toast.error("Koneksi gagal. Silakan isi manual.");
    } finally {
      setStartedAt(null);
    }
  }

  const pending = startedAt !== null;
  return (
    <section className="glass space-y-3 rounded-2xl border p-4">
      <div>
        <h2 className="flex items-center gap-2 font-medium">
          <Sparkles className="size-4" /> Tambah dengan AI
        </h2>
        <p className="text-muted-foreground text-xs">
          AI mengisi form di bawah sebagai draf, lengkap dengan kutipan buktinya. Kamu tetap bisa mengubah semuanya.
        </p>
        <p className={cn("mt-1 text-xs tabular-nums", left === 0 ? "text-destructive" : "text-muted-foreground")}>
          {left === 0
            ? "Kuota AI hari ini habis. Terisi lagi pukul 00.00 WIB; sementara isi manual dulu ya."
            : `Sisa kuota AI hari ini: ${left} dari ${quota.limit}. Satu gambar poster = 1 kuota.`}
        </p>
      </div>
      {image ? (
        <div className="space-y-1.5">
          <Label>Gambar poster</Label>
          <div className="bg-card flex items-start gap-3 rounded-xl border p-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
            <img src={image.dataUrl} alt="Pratinjau poster lowongan" className="max-h-40 w-auto rounded-md border" />
            <p className="text-muted-foreground min-w-0 flex-1 truncate text-xs">{image.name}</p>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Hapus gambar"
              onClick={() => setImage(null)}
              disabled={pending}
            >
              <X />
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="job-text">Teks lowongan</Label>
          <Textarea
            id="job-text"
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={(e) => {
              const file = imageEnabled
                ? [...e.clipboardData.files].find((f) => f.type.startsWith("image/"))
                : undefined;
              if (file) {
                e.preventDefault();
                void pickImage(file);
              }
            }}
            placeholder={
              imageEnabled
                ? "Salin seluruh isi lowongan lalu tempel di sini, atau tempel screenshot posternya (Ctrl+V)."
                : "Salin seluruh isi lowongan (posisi, persyaratan, deadline…) lalu tempel di sini."
            }
            disabled={pending}
          />
          {imageEnabled && (
            <Button type="button" variant="outline" size="sm" asChild disabled={pending}>
              <label className="cursor-pointer">
                <ImagePlus /> atau pilih gambar poster
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={pending}
                  onChange={(e) => {
                    void pickImage(e.target.files?.[0]);
                    e.target.value = ""; // picking the same file again still fires
                  }}
                />
              </label>
            </Button>
          )}
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="job-url">atau link lowongan</Label>
        <Input
          id="job-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          disabled={pending}
        />
        <p className="text-muted-foreground text-xs">
          {image
            ? "Gambar di atas yang dibaca AI. Link (kalau diisi) hanya disimpan ke kolom Link lowongan."
            : text.trim()
              ? "Teks lowongan di atas yang dibaca AI. Link (kalau diisi) hanya disimpan ke kolom Link lowongan."
              : "Beberapa situs (LinkedIn, JobStreet) menolak diambil otomatis. Kalau gagal, salin teksnya saja."}
        </p>
      </div>
      <ShinyButton onClick={extract} disabled={pending || left === 0}>
        <Sparkles /> {pending ? "AI sedang membaca…" : "Isi otomatis dengan AI"}
      </ShinyButton>
      {pending && <ExtractProgress status={status} elapsed={elapsed} />}
    </section>
  );
}
