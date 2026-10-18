"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteApplication, restoreApplication } from "@/actions/applications";
import { ConfirmBar } from "@/components/confirm-bar";
import { Button } from "@/components/ui/button";

/** Two-step delete (inline, no native dialog). After deleting, a toast offers "Urungkan" for a few seconds. */
export function DeleteApplicationButton({ id }: { id: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const res = await deleteApplication(id).catch(() => null);
      if (!res || !res.ok) {
        toast.error(res?.message ?? "Gagal menghapus lamaran. Coba lagi.");
        setAsking(false);
        return;
      }
      router.push("/board");
      toast("Lamaran dihapus.", {
        duration: 10_000,
        action: {
          label: "Urungkan",
          onClick: async () => {
            const r = await restoreApplication(res.snapshot).catch(() => ({ ok: false, message: "Gagal memulihkan." }));
            if (r.ok) toast.success(r.message);
            else toast.error(r.message);
            router.refresh();
          },
        },
      });
    });
  }

  if (!asking) {
    return (
      <Button type="button" variant="destructive" onClick={() => setAsking(true)}>
        Hapus lamaran
      </Button>
    );
  }
  return (
    <ConfirmBar
      message="Hapus lamaran ini beserta riwayatnya? Kamu bisa mengurungkannya sesaat setelah dihapus."
      confirmLabel="Ya, hapus"
      disabled={pending}
      onConfirm={remove}
      onCancel={() => setAsking(false)}
    />
  );
}
