"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Two-step delete: the first click asks inline (no native dialog), the second one submits. */
export function DeleteApplicationButton({ action }: { action: () => Promise<void> }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <Button type="button" variant="destructive" onClick={() => setAsking(true)}>
        Hapus lamaran
      </Button>
    );
  }
  return (
    <form action={action} className="bg-destructive/5 space-y-2 rounded-xl border border-destructive/20 p-3">
      <p className="text-sm">Hapus lamaran ini beserta riwayatnya? Tindakan ini tidak bisa dibatalkan.</p>
      <div className="flex gap-2">
        <Button type="submit" variant="destructive" autoFocus>
          Ya, hapus
        </Button>
        <Button type="button" variant="outline" onClick={() => setAsking(false)}>
          Batal
        </Button>
      </div>
    </form>
  );
}
