"use client";

import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteResume, getResumeUrl, renameResume } from "@/actions/resumes";
import { ConfirmBar } from "@/components/confirm-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ViewResumeButton({ id, label = "Lihat" }: { id: string; label?: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        // Open synchronously so the popup blocker allows it, then point it at the 60 s URL.
        const tab = window.open("", "_blank");
        startTransition(async () => {
          const { url, error } = await getResumeUrl(id);
          if (url && tab) tab.location.href = url;
          else {
            tab?.close();
            toast.error(error ?? "Gagal membuka CV.");
          }
        });
      }}
    >
      <ExternalLink /> {label}
    </Button>
  );
}

/** The CV's name with a pencil: edits in place, Enter saves and Esc cancels. */
export function ResumeName({ id, name }: { id: string; name: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [pending, startTransition] = useTransition();

  function save() {
    if (value.trim() === name) return setEditing(false);
    startTransition(async () => {
      const res = await renameResume(id, value);
      if (!res.ok) return void toast.error(res.message ?? "Gagal mengubah nama.");
      toast.success("Nama CV diubah.");
      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <div className="flex min-w-0 items-center gap-1">
        <p className="truncate font-medium">{name}</p>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Ubah nama ${name}`}
          onClick={() => {
            setValue(name);
            setEditing(true);
          }}
        >
          <Pencil />
        </Button>
      </div>
    );
  }
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Input
        autoFocus
        value={value}
        maxLength={100}
        aria-label="Nama CV"
        className="w-40 max-w-full"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
      />
      <Button type="submit" size="sm" disabled={pending || !value.trim()}>
        {pending ? "Menyimpan…" : "Simpan"}
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setEditing(false)}>
        Batal
      </Button>
    </form>
  );
}

export function DeleteResumeButton({ id, name, usedBy }: { id: string; name: string; usedBy: number }) {
  const [pending, startTransition] = useTransition();
  const [asking, setAsking] = useState(false);
  if (asking) {
    const warn = usedBy ? ` CV ini tertaut ke ${usedBy} lamaran; tautannya akan dilepas.` : "";
    return (
      <ConfirmBar
        className="w-full"
        message={`Hapus "${name}"?${warn}`}
        confirmLabel="Ya, hapus"
        disabled={pending}
        onConfirm={() => startTransition(() => deleteResume(id))}
        onCancel={() => setAsking(false)}
      />
    );
  }
  return (
    <Button variant="ghost" size="icon-sm" aria-label={`Hapus ${name}`} onClick={() => setAsking(true)}>
      <Trash2 />
    </Button>
  );
}
