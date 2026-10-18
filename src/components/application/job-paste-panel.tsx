"use client";

import type { DeepPartial } from "ai";
import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AiFindings } from "@/components/application/ai-findings";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ExtractEvent } from "@/lib/ai/extract-events";
import type { ExtractedJob } from "@/lib/ai/extract-job";
import { ShinyButton } from "@/components/ui/shiny-button";

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

export function JobPastePanel({ onResult }: { onResult: (r: ExtractResult) => void }) {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState<Status>("reading");
  const [partial, setPartial] = useState<DeepPartial<ExtractedJob> | null>(null);

  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  async function extract() {
    if (!text.trim() && !url.trim()) return toast.error("Tempel teks lowongan atau link-nya dulu.");
    setStartedAt(Date.now());
    setElapsed(0);
    setStatus(text.trim() ? "reading" : "fetching");
    setPartial(null);
    try {
      const res = await fetch("/api/ai/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(text.trim() ? { text } : { url: url.trim() }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        return toast.error(body.error ?? "AI sedang tidak tersedia, silakan isi manual.");
      }
      for await (const event of readEvents(res)) {
        if (event.type === "status") {
          setStatus(event.status);
          // A retry or a fallback model starts writing from scratch.
          if (event.status === "retrying" || event.status === "fallback") setPartial(null);
        } else if (event.type === "partial") {
          setPartial(event.job);
        } else if (event.type === "result") {
          onResult({ ...event, sourceUrl: url.trim() || undefined });
          toast.success(event.cached ? "Draf diisi (dari cache)." : "Draf diisi. Tinjau dulu sebelum menyimpan.");
          return;
        } else {
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
        <p className="text-xs text-muted-foreground">
          AI mengisi form di bawah sebagai draf, lengkap dengan kutipan buktinya. Kamu tetap bisa mengubah semuanya.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="job-text">Teks lowongan</Label>
        <Textarea
          id="job-text"
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Salin seluruh isi lowongan (posisi, persyaratan, deadline…) lalu tempel di sini."
          disabled={pending}
        />
      </div>
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
        <p className="text-xs text-muted-foreground">
          {text.trim()
            ? "Teks lowongan di atas yang dibaca AI. Link (kalau diisi) hanya disimpan ke kolom Link lowongan."
            : "Beberapa situs (LinkedIn, JobStreet) menolak diambil otomatis. Kalau gagal, salin teksnya saja."}
        </p>
      </div>
      <ShinyButton onClick={extract} disabled={pending}>
        <Sparkles /> {pending ? "AI sedang membaca…" : "Isi otomatis dengan AI"}
      </ShinyButton>
      {pending && <AiFindings status={status} job={partial} elapsed={elapsed} />}
    </section>
  );
}
