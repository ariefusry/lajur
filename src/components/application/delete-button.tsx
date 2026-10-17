"use client";

import { Button } from "@/components/ui/button";

export function DeleteApplicationButton({ action }: { action: () => Promise<void> }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Hapus lamaran ini beserta riwayatnya? Tindakan ini tidak bisa dibatalkan.")) e.preventDefault();
      }}
    >
      <Button type="submit" variant="destructive">
        Hapus lamaran
      </Button>
    </form>
  );
}
