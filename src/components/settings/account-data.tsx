"use client";

import { Download, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteAccount, exportApplicationsCsv } from "@/actions/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CONFIRM_WORD = "HAPUS";

/** Download everything as CSV, and delete the account (type-to-confirm, nothing to undo). */
export function AccountData({ isDemo, applicationCount }: { isDemo: boolean; applicationCount: number }) {
  const [exporting, startExport] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [asking, setAsking] = useState(false);
  const [typed, setTyped] = useState("");

  function download() {
    startExport(async () => {
      try {
        const { filename, csv } = await exportApplicationsCsv();
        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
        const a = Object.assign(document.createElement("a"), { href: url, download: filename });
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        toast.error("Gagal mengekspor. Coba lagi.");
      }
    });
  }

  function remove() {
    startDelete(async () => {
      // On success the action redirects away; it only returns on refusal.
      const res = await deleteAccount(typed).catch(() => ({
        ok: false as const,
        message: "Gagal menghapus akun. Coba lagi.",
      }));
      if (res && !res.ok) toast.error(res.message);
    });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Unduh data</h3>
        <p className="text-muted-foreground text-sm">
          Semua lamaran ({applicationCount}) dalam satu file CSV, bisa dibuka di Excel atau Google Sheets: tahap,
          riwayat, jadwal, follow-up, dan catatan.
        </p>
        <Button type="button" variant="outline" onClick={download} disabled={exporting || applicationCount === 0}>
          <Download /> {exporting ? "Menyiapkan…" : "Unduh CSV"}
        </Button>
      </div>

      <div className="border-destructive/30 space-y-2 rounded-xl border p-4">
        <h3 className="text-destructive text-sm font-medium">Hapus akun</h3>
        <p className="text-muted-foreground text-sm">
          Menghapus akun beserta semua lamaran, riwayat, jadwal, profil, dan file CV secara permanen. Tidak bisa
          dibatalkan. Unduh CSV dulu kalau ingin menyimpan salinannya.
        </p>
        {isDemo ? (
          <p className="text-muted-foreground text-sm">Akun demo tidak bisa dihapus.</p>
        ) : !asking ? (
          <Button type="button" variant="destructive" onClick={() => setAsking(true)}>
            <Trash2 /> Hapus akun…
          </Button>
        ) : (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (typed.trim() === CONFIRM_WORD) remove();
            }}
          >
            <label htmlFor="confirm-delete" className="w-full text-sm">
              Ketik <strong>{CONFIRM_WORD}</strong> untuk mengonfirmasi:
            </label>
            <Input
              id="confirm-delete"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoFocus
              className="w-40"
            />
            <Button type="submit" variant="destructive" disabled={deleting || typed.trim() !== CONFIRM_WORD}>
              {deleting ? "Menghapus…" : "Hapus permanen"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setAsking(false);
                setTyped("");
              }}
            >
              Batal
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
