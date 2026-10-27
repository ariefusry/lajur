"use client";

import { ExternalLink, LoaderCircle, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { DomicilePicker } from "@/components/settings/domicile-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ShinyButton } from "@/components/ui/shiny-button";
import type { CvProfile } from "@/lib/ai/cv-profile";
import { buildSearchLinks, searchKeywords } from "@/lib/jobs/search-links";
import { cn } from "@/lib/utils";

export type JobResume = { id: string; versionName: string; hasText: boolean; profile: CvProfile | null };

const chip = (on: boolean) =>
  cn(
    "rounded-full border px-3 py-1 text-sm transition-colors",
    on ? "border-primary bg-primary/10 text-primary font-medium" : "hover:bg-muted",
  );

/**
 * Search words (role, one skill, city) → links that open the job portals' own search pages. Nothing is fetched
 * or stored from the portals. The role is a plain input, so it works without a CV or without AI; the CV only
 * fills in suggestions.
 */
export function JobSearch({
  resumes,
  domicile,
  aiAvailable,
  aiConsented,
  readOnly,
}: {
  resumes: JobResume[];
  domicile: string;
  /** An AI provider is configured. */
  aiAvailable: boolean;
  aiConsented: boolean;
  readOnly: boolean;
}) {
  const [resumeId, setResumeId] = useState(resumes[0]?.id ?? "");
  const [profiles, setProfiles] = useState(() => Object.fromEntries(resumes.map((r) => [r.id, r.profile])));
  const [role, setRole] = useState(resumes[0]?.profile?.roles[0] ?? "");
  const [skill, setSkill] = useState<string | null>(null);
  const [city, setCity] = useState(domicile);
  const [pending, setPending] = useState(false);

  const resume = resumes.find((r) => r.id === resumeId);
  const profile = profiles[resumeId] ?? null;
  const links = buildSearchLinks({ role, skill, city });

  function pickResume(id: string) {
    setResumeId(id);
    setRole(profiles[id]?.roles[0] ?? "");
    setSkill(null);
  }

  async function generate() {
    setPending(true);
    try {
      const res = await fetch("/api/ai/cv-profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resumeId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return toast.error(body.error ?? "Gagal membaca CV.");
      setProfiles((p) => ({ ...p, [resumeId]: body as CvProfile }));
      setRole((body as CvProfile).roles[0] ?? "");
      setSkill(null);
    } catch {
      toast.error("Koneksi gagal. Coba lagi.");
    } finally {
      setPending(false);
    }
  }

  const canGenerate = aiAvailable && !readOnly && !!resume?.hasText;

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <div className="space-y-6">
        <section className="glass space-y-3 rounded-2xl border p-4">
          <h2 className="font-medium">1. Dari CV mana?</h2>
          {resumes.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Belum ada CV.{" "}
              <Link href="/resumes" className="text-primary underline underline-offset-4">
                Unggah CV
              </Link>{" "}
              untuk mendapat saran peran, atau isi peran di bawah sendiri.
            </p>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-0 flex-1 space-y-1.5 sm:max-w-xs">
                <Label htmlFor="resume">CV</Label>
                <Select
                  id="resume"
                  value={resumeId}
                  onValueChange={pickResume}
                  options={resumes.map((r) => ({ value: r.id, label: r.versionName }))}
                />
              </div>
              {canGenerate && aiConsented && (
                <ShinyButton onClick={generate} disabled={pending}>
                  {pending ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : <Sparkles />}
                  {pending ? "AI sedang membaca…" : profile ? "Baca ulang dengan AI" : "Saran peran dengan AI"}
                </ShinyButton>
              )}
            </div>
          )}
          {resume && !resume.hasText && (
            <p className="text-muted-foreground text-xs">Teks CV ini tidak terbaca, jadi isi peran sendiri.</p>
          )}
          {canGenerate && !aiConsented && (
            <p className="text-muted-foreground text-xs">
              Untuk saran dari CV,{" "}
              <Link href="/settings" className="text-primary underline underline-offset-4">
                setujui pemrosesan AI di Pengaturan
              </Link>
              .
            </p>
          )}
          {canGenerate && aiConsented && (
            <p className="text-muted-foreground text-xs">
              Hanya bagian keahlian dan pengalaman (tanpa nama dan kontak) yang dikirim ke AI.
            </p>
          )}
        </section>

        <section className="glass space-y-4 rounded-2xl border p-4">
          <h2 className="font-medium">2. Yang dicari</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="role">Peran</Label>
              <Input
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Contoh: Frontend Developer"
                maxLength={60}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">Kota (opsional)</Label>
              <DomicilePicker id="city" name="city" defaultValue={domicile} onValueChange={setCity} />
            </div>
          </div>
          {profile && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <p className="text-muted-foreground text-xs">Saran peran dari CV</p>
                <div className="flex flex-wrap gap-2">
                  {profile.roles.map((r) => (
                    <button
                      key={r}
                      type="button"
                      aria-pressed={r === role}
                      className={chip(r === role)}
                      onClick={() => setRole(r)}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              {profile.skills.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-muted-foreground text-xs">Tambah satu keahlian ke kata kunci (opsional)</p>
                  <div className="flex flex-wrap gap-2">
                    {profile.skills.map((s) => (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={s === skill}
                        className={chip(s === skill)}
                        onClick={() => setSkill(s === skill ? null : s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      <section className="glass space-y-3 rounded-2xl border p-4 lg:sticky lg:top-6">
        <h2 className="font-medium">3. Buka pencarian di portal</h2>
        {links.length === 0 ? (
          <p className="text-muted-foreground text-sm">Isi peran dulu, lalu tautan portal muncul di sini.</p>
        ) : (
          <>
            <p className="text-sm">
              Kata kunci: <b className="font-semibold">{searchKeywords({ role, skill })}</b>
            </p>
            <div className="grid gap-2">
              {links.map((l) => (
                <Button key={l.id} asChild variant="outline" className="h-auto justify-between py-3">
                  <a href={l.url} target="_blank" rel="noopener noreferrer">
                    <span className="flex items-center gap-3">
                      <Image
                        src={`/portals/${l.id}.png`}
                        alt=""
                        width={28}
                        height={28}
                        className="size-7 rounded-md object-contain"
                      />
                      <span className="flex flex-col items-start leading-tight">
                        <span>{l.portal}</span>
                        {l.note && <span className="text-muted-foreground text-xs font-normal">{l.note}</span>}
                      </span>
                    </span>
                    <ExternalLink />
                  </a>
                </Button>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">
              Yang dikirim ke portal hanya peran, keahlian, dan kota. Tautan dibuka dari browser kamu. Setelah menemukan
              lowongan yang cocok, tempel teksnya di{" "}
              <Link href="/applications/new" className="text-primary underline underline-offset-4">
                Lamaran baru
              </Link>{" "}
              untuk cek syarat dan kelayakan.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
