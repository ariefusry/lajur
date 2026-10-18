"use client";

import { FileUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_PDF_BYTES } from "@/lib/pdf";

export function ResumeUpload() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const file = data.get("file");
    if (!(file instanceof File) || file.size === 0) return toast.error("Pilih file PDF dulu.");
    // Server re-validates; this just saves a pointless 4 MB round trip.
    if (file.size > MAX_PDF_BYTES) return toast.error("Ukuran file maksimal 4 MB.");

    setPending(true);
    try {
      const res = await fetch("/api/resumes/upload", { method: "POST", body: data });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return toast.error(body.error ?? "Gagal mengunggah CV.");
      toast.success(body.hasText ? "CV diunggah." : "CV diunggah, tapi teksnya tidak terbaca (mungkin hasil scan).");
      formRef.current?.reset();
      setFileName(null);
      router.refresh();
    } catch {
      toast.error("Koneksi gagal. Coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="versionName">Nama versi</Label>
        <Input id="versionName" name="versionName" placeholder="CV Umum v2" required maxLength={100} />
      </div>
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor="file">File PDF (maks. 4 MB)</Label>
        <input
          ref={fileRef}
          id="file"
          name="file"
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
        <Button type="button" variant="outline" className="w-full justify-start" onClick={() => fileRef.current?.click()}>
          <FileUp />
          <span className="truncate">{fileName ?? "Pilih file PDF…"}</span>
        </Button>
      </div>
      <Button type="submit" disabled={pending || !fileName}>
        {pending ? "Mengunggah…" : "Unggah"}
      </Button>
    </form>
  );
}
