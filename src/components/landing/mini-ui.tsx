import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Small pieces of the app drawn in HTML for the landing page. Every value is an example (and the page says so),
 * not a customer's data. Cards float over the page, so they carry the soft shadow.
 */
export const FLOAT_SHADOW = "shadow-[0_14px_34px_-18px_rgba(11,13,18,0.35)]";

const card = cn("bg-card w-full rounded-2xl border p-3.5 text-left", FLOAT_SHADOW);

export function ApplicationCard() {
  return (
    <div className={card}>
      <p className="text-sm font-semibold">Staf Administrasi</p>
      <p className="text-muted-foreground text-xs">PT Contoh Maju · JobStreet</p>
      <p className="bg-muted mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium">Psikotes</p>
    </div>
  );
}

export function EventCard() {
  return (
    <div className={card}>
      <p className="text-muted-foreground text-xs">Tes online</p>
      <p className="text-sm font-semibold">Kamis, 12 November</p>
      <p className="text-muted-foreground text-xs">09.00 WIB · masuk ke Google Calendar</p>
    </div>
  );
}

export function RequirementCard() {
  return (
    <div className={card}>
      <p className="text-muted-foreground text-xs">Syarat lowongan</p>
      <p className="text-sm font-semibold">IPK minimal 3,00</p>
      <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
        <Check className="size-3.5" strokeWidth={3} aria-hidden /> Memenuhi
      </p>
    </div>
  );
}

export function ReminderCard() {
  return (
    <div className={card}>
      <p className="text-muted-foreground text-xs">Pengingat H-1</p>
      <p className="text-sm font-semibold">Interview HR besok, 10.00</p>
      <p className="text-muted-foreground text-xs">Dikirim lewat email</p>
    </div>
  );
}

export function CvCard() {
  return (
    <div className={card}>
      <p className="text-muted-foreground text-xs">Cek CV untuk lowongan ini</p>
      <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
        <Check className="size-3.5 text-emerald-700 dark:text-emerald-400" strokeWidth={3} aria-hidden /> React ada di
        CV
      </p>
      <p className="text-muted-foreground mt-0.5 text-sm">Docker belum ada</p>
    </div>
  );
}

// Mirrors "Per sumber lowongan" on the Analytics page: a source, how many of the applications that reached the
// administration stage passed it, as a small bar and an "x dari y". The numbers are examples.
const SOURCES = [
  ["JobStreet", 5, 12],
  ["Glints", 3, 8],
  ["LinkedIn", 1, 6],
] as const;

export function SourceTable({ className }: { className?: string }) {
  return (
    <div className={cn(card, className)}>
      <p className="text-sm font-semibold">Per sumber lowongan</p>
      <p className="text-muted-foreground text-xs">Lolos administrasi</p>
      <ul className="mt-3 space-y-2.5">
        {SOURCES.map(([name, passed, of]) => (
          <li key={name} className="text-xs">
            <div className="flex items-baseline justify-between gap-3">
              <span>{name}</span>
              <span className="text-muted-foreground tabular-nums">
                {passed} dari {of}
              </span>
            </div>
            <span className="bg-muted mt-1 block h-2 rounded-full" aria-hidden>
              <span
                data-lm="bar"
                className="block h-2 rounded-full bg-[var(--brand)]"
                style={{ width: `${(passed / of) * 100}%` }}
              />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RequirementList() {
  const rows = [
    ["IPK minimal 3,00", "Memenuhi"],
    ["Usia maksimal 25 tahun", "Memenuhi"],
    ["Jurusan terkait", "Perlu dicek"],
  ];
  return (
    <ul className="space-y-2">
      {rows.map(([label, status]) => (
        <li
          key={label}
          className="bg-background flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm"
        >
          <span>{label}</span>
          <span
            className={cn(
              "text-xs font-medium",
              status === "Memenuhi" ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400",
            )}
          >
            {status}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ReminderList() {
  const rows = [
    ["H-3", "Tes online"],
    ["H-1", "Interview HR"],
  ];
  return (
    <ul className="space-y-2">
      {rows.map(([when, what]) => (
        <li key={when} className="bg-background flex items-center gap-3 rounded-xl border px-3 py-2 text-sm">
          <span className="bg-muted rounded-md px-2 py-0.5 font-mono text-xs">{when}</span>
          {what}
        </li>
      ))}
    </ul>
  );
}

export function ApplicationTable() {
  const rows = [
    ["PT Contoh Maju", "Staf Administrasi", "Psikotes", "CV Umum v2"],
    ["Bank Contoh Raya", "Customer Service", "Interview HR", "CV Umum v2"],
    ["Startup Contoh", "Frontend Developer", "Wishlist", "CV Fullstack"],
  ];
  return (
    <div className="bg-background overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[30rem] text-left text-sm">
        <thead className="text-muted-foreground text-xs">
          <tr>
            {["Perusahaan", "Posisi", "Tahap", "Versi CV"].map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r[0]}>
              {r.map((c) => (
                <td key={c} className="px-3 py-2">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
