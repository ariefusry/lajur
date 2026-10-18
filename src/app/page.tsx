import {
  ArrowRight,
  BellRing,
  ChartColumn,
  CircleCheck,
  FileText,
  KanbanSquare,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { redirect } from "next/navigation";
import { signInAsDemo } from "@/actions/demo";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { demoLoginEnabled } from "@/lib/demo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Lajur · Tracker lamaran kerja",
  description:
    "Catat semua lamaran kerja, deadline, dan tahap seleksi khas Indonesia di satu tempat. Pengingat jadwal tes, cek syarat otomatis, dan analisis CV mana yang paling sering lolos.",
};

const STAGES = ["Administrasi", "Tes Online/TPA", "Psikotes", "LGD", "Interview HR", "Interview User", "MCU", "Offering"];

const FEATURES = [
  {
    icon: Sparkles,
    title: "Tambah dengan AI, form terisi",
    text: "AI membaca teks lowongan: perusahaan, posisi, deadline, dan syaratnya, lengkap dengan kutipan bukti. Kamu cek dulu sebelum disimpan.",
  },
  {
    icon: ShieldCheck,
    title: "Cek syarat otomatis",
    text: "IPK minimal, batas usia, jurusan, jenjang, penempatan, ikatan dinas: langsung dicocokkan dengan profilmu, tanpa AI.",
  },
  {
    icon: KanbanSquare,
    title: "Board tahap seleksi",
    text: "Geser kartu dari Administrasi sampai Offering. Riwayat tiap tahap tercatat, lengkap dengan catatan pertanyaan wawancara.",
  },
  {
    icon: BellRing,
    title: "Tidak ada yang terlewat",
    text: "Pengingat email H-3 dan H-1 untuk tes dan interview, follow-up yang jatuh tempo, dan sekali klik ke Google Calendar.",
  },
  {
    icon: FileText,
    title: "Versi CV dan gap skill",
    text: "Simpan beberapa versi CV, tandai mana yang dikirim ke mana, dan lihat skill lowongan yang belum ada di CV-mu.",
  },
  {
    icon: ChartColumn,
    title: "Tahu strategi mana yang berhasil",
    text: "Response rate per sumber lowongan dan versi CV, tahap yang paling sering membuat gagal, dan lamaran yang mulai ghosting.",
  },
];

const STEPS = [
  { title: "Tambah dengan AI", text: "Tempel teks lowongan dari JobStreet, Glints, portal BUMN, atau caption Instagram. Atau isi manual." },
  { title: "Geser saat tahapnya berubah", text: "Lolos administrasi? Diundang psikotes? Pindahkan kartunya, jadwalnya diingatkan." },
  { title: "Lihat polanya", text: "Setelah beberapa lamaran, dashboard menunjukkan apa yang perlu diperbaiki." },
];

const PRIVACY = [
  "File CV disimpan privat dan hanya dibuka lewat tautan sementara 60 detik.",
  "Sebelum ke AI, nama, email, nomor HP, alamat, dan tautan di CV disamarkan.",
  "Unduh semua datamu sebagai CSV, atau hapus akun beserta isinya kapan saja.",
];

export default async function Landing({ searchParams }: { searchParams: Promise<{ akun?: string }> }) {
  if ((await auth())?.user) redirect("/dashboard");
  const { akun } = await searchParams;
  const demo = demoLoginEnabled();

  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-30 border-b bg-background/70 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/" aria-label="Lajur, beranda">
            <Logo className="text-lg" markClassName="size-6" />
          </Link>
          <nav aria-label="Bagian halaman" className="text-muted-foreground hidden items-center gap-6 text-sm md:flex">
            <a href="#fitur" className="hover:text-foreground transition-colors">
              Fitur
            </a>
            <a href="#cara-kerja" className="hover:text-foreground transition-colors">
              Cara kerja
            </a>
            <a href="#privasi" className="hover:text-foreground transition-colors">
              Privasi
            </a>
          </nav>
          <Button asChild size="sm">
            <Link href="/login">Masuk</Link>
          </Button>
        </div>
      </header>

      <main>
        {akun === "dihapus" && (
          <p role="status" className="mx-auto mt-4 max-w-6xl px-4">
            <span className="glass block rounded-xl border px-4 py-3 text-sm">
              Akunmu dan semua datanya sudah dihapus. Terima kasih sudah memakai Lajur.
            </span>
          </p>
        )}

        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pt-16 pb-10 text-center md:pt-24">
          <p className="text-primary mb-4 text-sm font-medium">Tracker lamaran kerja untuk pencari kerja di Indonesia</p>
          <h1 className="mx-auto max-w-3xl text-4xl leading-[1.08] font-semibold tracking-tight text-balance md:text-6xl">
            Semua lamaran kerjamu, rapi di satu tempat.
          </h1>
          <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-lg text-pretty">
            Catat tahap seleksi dari administrasi sampai offering, jangan lagi lupa deadline dan jadwal tes, dan
            ketahui versi CV mana yang paling sering lolos.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/login">
                Mulai gratis <ArrowRight />
              </Link>
            </Button>
            {demo && (
              <form action={signInAsDemo}>
                <Button type="submit" size="lg" variant="outline">
                  Coba akun demo
                </Button>
              </form>
            )}
          </div>
          <p className="text-muted-foreground mt-3 text-xs">Masuk dengan Google. Tanpa biaya, tanpa iklan.</p>
        </section>

        {/* Product shot */}
        <section className="mx-auto max-w-6xl px-4" aria-label="Tampilan aplikasi">
          <div className="glass overflow-hidden rounded-3xl border p-2 shadow-2xl md:p-3">
            <Image
              src="/landing/dashboard.png"
              alt="Dashboard Lajur: jadwal 7 hari ke depan, lamaran yang perlu di-follow-up, dan pipeline tahap seleksi"
              width={1440}
              height={900}
              priority
              className="w-full rounded-2xl border"
            />
          </div>
        </section>

        {/* Indonesian selection stages */}
        <section className="mx-auto max-w-6xl px-4 py-16 text-center">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Paham tahap seleksi di sini</h2>
          <p className="text-muted-foreground mx-auto mt-2 max-w-xl">
            Template siap pakai untuk BUMN dan bank, startup, retail, CPNS, atau umum. Tinggal ubah sesuai perusahaan.
          </p>
          <ol className="mt-8 flex flex-wrap items-center justify-center gap-2" aria-label="Contoh tahap seleksi BUMN">
            {STAGES.map((s, i) => (
              <li key={s} className="flex items-center gap-2">
                <span
                  className={cn(
                    "glass rounded-full border px-3.5 py-1.5 text-sm font-medium",
                    i === STAGES.length - 1 && "border-green-600/30 text-green-700 dark:text-green-400",
                  )}
                >
                  {s}
                </span>
                {i < STAGES.length - 1 && <ArrowRight className="text-muted-foreground size-3.5" aria-hidden />}
              </li>
            ))}
          </ol>
        </section>

        {/* Features */}
        <section id="fitur" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-10">
          <div className="mb-8 max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Semua yang kamu butuhkan selama mencari kerja</h2>
            <p className="text-muted-foreground mt-2">Bukan spreadsheet lagi. Dibuat untuk dipakai setiap hari, di laptop maupun HP.</p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="glass rounded-2xl border p-5">
                <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-xl">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-semibold tracking-tight">{title}</h3>
                <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Board screenshot + how it works */}
        <section id="cara-kerja" className="mx-auto grid max-w-6xl scroll-mt-20 items-center gap-10 px-4 py-16 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Cara kerjanya</h2>
            <ol className="mt-6 space-y-6">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-4">
                  <span className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold tracking-tight">{s.title}</h3>
                    <p className="text-muted-foreground mt-1 text-sm">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="glass overflow-hidden rounded-3xl border p-2 shadow-xl">
            <Image
              src="/landing/board.png"
              alt="Board Lajur: kolom tahap seleksi dengan kartu lamaran yang bisa digeser"
              width={1440}
              height={640}
              className="w-full rounded-2xl border"
            />
          </div>
        </section>

        {/* Privacy */}
        <section id="privasi" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-10">
          <div className="glass grid gap-8 rounded-3xl border p-6 md:grid-cols-[auto_1fr] md:p-10">
            <span className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-2xl">
              <LockKeyhole className="size-6" aria-hidden />
            </span>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">CV dan data pribadimu tetap milikmu</h2>
              <ul className="mt-4 space-y-2.5">
                {PRIVACY.map((p) => (
                  <li key={p} className="flex gap-2.5 text-sm">
                    <CircleCheck className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-6xl px-4 py-20 text-center">
          <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-balance md:text-4xl">
            Lamaran berikutnya, kali ini tercatat rapi.
          </h2>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/login">
                Mulai gratis <ArrowRight />
              </Link>
            </Button>
            {demo && (
              <form action={signInAsDemo}>
                <Button type="submit" size="lg" variant="outline">
                  Coba akun demo
                </Button>
              </form>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="text-muted-foreground mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-xs">
          <span className="inline-flex items-center gap-2">
            <Logo markClassName="size-4" /> · dibuat untuk pencari kerja di Indonesia
          </span>
          <Link href="/login" className="hover:text-foreground">
            Masuk
          </Link>
        </div>
      </footer>
    </div>
  );
}
