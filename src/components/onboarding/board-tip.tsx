"use client";

import { Lightbulb, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const KEY = "lajur:board-tip-dismissed";

/** One-time tip for users fresh out of the /mulai wizard. Dismissal is per browser: it's only a convenience. */
export function BoardTip() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(!localStorage.getItem(KEY));
    } catch {
      setShow(true);
    }
  }, []);
  if (!show) return null;

  return (
    <div className="bg-primary/10 border-primary/20 flex items-start gap-3 rounded-xl border p-3 text-sm">
      <Lightbulb className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
      <p className="flex-1">
        Geser kartu ke kolom berikutnya saat kamu lolos ke tahap baru (atau pakai tombol ⇄ di kartu). Tambahkan jadwal
        tes atau interview di detail lamaran supaya dapat email pengingat H-3 dan H-1.
      </p>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Tutup tips"
        onClick={() => {
          setShow(false);
          try {
            localStorage.setItem(KEY, "1");
          } catch {}
        }}
      >
        <X />
      </Button>
    </div>
  );
}
