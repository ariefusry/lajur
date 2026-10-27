import { Brain, Check, FileText, MessagesSquare, MonitorCheck, Stethoscope, Users } from "lucide-react";
import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { signInAsDemo } from "@/actions/demo";
import { HowItWorksVideo } from "@/components/how-it-works-video";
import {
  ApplicationCard,
  ApplicationTable,
  CvCard,
  EventCard,
  FLOAT_SHADOW,
  ReminderCard,
  ReminderList,
  RequirementCard,
  RequirementList,
  SourceTable,
} from "@/components/landing/mini-ui";
import { LandingMotion } from "@/components/landing/landing-motion";
import { Words } from "@/components/landing/words";
import { Logo, LogoMark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { demoLoginEnabled } from "@/lib/demo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Lajur · Tracker lamaran kerja",
  description:
    "Catat semua lamaran kerja, deadline, dan tahap seleksi khas Indonesia di satu tempat. Pengingat jadwal tes, cek syarat otomatis, dan analisis CV mana yang paling sering lolos.",
};

// Designed in Jakarta for Indonesian readers, and firm at large sizes (DESIGN.md). Body text stays in the app's Geist.
const displayFont = Plus_Jakarta_Sans({
  weight: ["600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-display",
});
const DISPLAY = "font-[family-name:var(--font-display)]";
const H2 = cn(DISPLAY, "text-3xl leading-[1.1] font-bold tracking-[-0.03em] text-balance md:text-5xl");

// Six of the eight stages of the BUMN template (not numbered: two do not fit, so a number would show a gap). x/y are percent of the hero box (mx/my on phones, where
// only the `m` ones show and no lines are drawn).
const NODES = [
  { label: "Administrasi", Icon: FileText, x: 10, y: 50, mx: 27, my: 14, m: true },
  { label: "Tes Online/TPA", Icon: MonitorCheck, x: 20, y: 21, mx: 27, my: 14, m: false },
  { label: "Psikotes", Icon: Brain, x: 20, y: 79, mx: 27, my: 86, m: true },
  { label: "LGD", Icon: Users, x: 80, y: 21, mx: 73, my: 14, m: false },
  { label: "Interview", Icon: MessagesSquare, x: 90, y: 50, mx: 73, my: 14, m: true },
  { label: "MCU", Icon: Stethoscope, x: 80, y: 79, mx: 73, my: 86, m: true },
];

// App pieces floating around the second heading: left/top in percent of the box, rotation in degrees.
const FLOATS = [
  { Card: ApplicationCard, l: 2, t: 4, r: -5 },
  { Card: RequirementCard, l: 6, t: 38, r: 4 },
  { Card: EventCard, l: 3, t: 72, r: -3 },
  { Card: ReminderCard, l: 74, t: 2, r: 5 },
  { Card: CvCard, l: 71, t: 38, r: -4 },
  { Card: SourceTable, l: 74, t: 70, r: 3 },
];

// The portals the "Cari lowongan" feature opens (src/lib/jobs/search-links.ts).
const PORTALS = [
  { id: "jobstreet", ext: "svg", name: "Jobstreet", note: "dengan filter kota", r: -14, big: false },
  { id: "glints", ext: "svg", name: "Glints", note: "dengan filter kota", r: -5, big: true },
  { id: "linkedin", ext: "svg", name: "LinkedIn", note: "7 hari terakhir", r: 5, big: true },
  { id: "kalibrr", ext: "png", name: "Kalibrr", note: "tanpa filter kota", r: 14, big: false },
];

const STEPS = [
  {
    title: "Tambah dengan AI",
    text: "Tempel teks lowongan dari JobStreet, Glints, portal BUMN, atau caption Instagram. Atau isi manual.",
    r: -2,
  },
  {
    title: "Geser saat tahapnya berubah",
    text: "Lolos administrasi? Diundang psikotes? Pindahkan kartunya, jadwalnya diingatkan.",
    r: 0,
  },
  {
    title: "Lihat polanya",
    text: "Setelah beberapa lamaran, dashboard menunjukkan apa yang perlu diperbaiki.",
    r: 2,
  },
];

const PRIVACY = [
  "File CV disimpan privat dan hanya dibuka lewat tautan sementara 60 detik.",
  "Sebelum ke AI, nama, email, nomor HP, alamat, dan tautan di CV disamarkan.",
  "Unduh semua datamu sebagai CSV, atau hapus akun beserta isinya kapan saja.",
];

const bento = "bg-card flex min-w-0 flex-col justify-between gap-6 rounded-3xl border p-5 md:p-6";

function DemoButton() {
  return (
    <form action={signInAsDemo}>
      <Button type="submit" size="lg" variant="outline" className="rounded-full">
        Coba akun demo
      </Button>
    </form>
  );
}

export default async function Landing({ searchParams }: { searchParams: Promise<{ akun?: string }> }) {
  if ((await auth())?.user) redirect("/dashboard");
  const { akun } = await searchParams;
  const demo = demoLoginEnabled();

  return (
    <div className={cn("landing bg-background text-foreground min-h-svh", displayFont.variable)}>
      {/* Floating nav: one opaque pill that sits over the content while scrolling */}
      <header className="sticky top-3 z-30 px-4 pt-3">
        <div
          className={cn(
            "bg-card mx-auto grid max-w-3xl grid-cols-[1fr_auto] items-center gap-3 rounded-full border p-1.5 md:grid-cols-[1fr_auto_1fr]",
            FLOAT_SHADOW,
          )}
        >
          <Link href="/" aria-label="Lajur, beranda" className="justify-self-start pl-2.5">
            <Logo className="text-base" markClassName="size-5" />
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
          <div className="flex items-center gap-1 justify-self-end">
            <ThemeToggle />
            <Button asChild size="sm" variant="ghost" className="hidden rounded-full sm:inline-flex">
              <Link href="/login">Masuk</Link>
            </Button>
            <Button asChild size="sm" className="rounded-full">
              <Link href="/login">
                <span className="sm:hidden">Masuk</span>
                <span className="hidden sm:inline">Mulai gratis</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <LandingMotion />
      <main>
        {akun === "dihapus" && (
          <p role="status" className="mx-auto mt-4 max-w-6xl px-4">
            <span className="bg-card block rounded-xl border px-4 py-3 text-sm">
              Akunmu dan semua datanya sudah dihapus. Terima kasih sudah memakai Lajur.
            </span>
          </p>
        )}

        {/* Hero: the Lajur node, joined by thin lines to the stages of a selection process */}
        <section data-lm="hero" className="mx-auto max-w-6xl px-4 pt-8 pb-10 text-center md:pt-12">
          <div data-lm="hero-box" className="relative mx-auto h-72 max-w-5xl sm:h-80 md:h-96" aria-hidden>
            <svg
              data-lm="hero-fade"
              className="text-foreground absolute inset-0 hidden size-full overflow-visible md:block"
              fill="none"
            />
            {/* GSAP moves the zero-size anchors; the centring lives on the child, where GSAP never reads it. */}
            <div data-lm="hero-tile" data-speed="20" className="absolute top-1/2 left-1/2 size-0">
              <div
                className={cn(
                  "absolute top-0 left-0 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl bg-[var(--brand)] text-white sm:size-20",
                  FLOAT_SHADOW,
                )}
              >
                <LogoMark className="size-9 sm:size-11" />
              </div>
            </div>
            {NODES.map((n, i) => (
              <div
                key={n.label}
                data-lm="hero-tile"
                data-speed={30 + (i % 3) * 25}
                style={
                  {
                    "--x": `${n.x}%`,
                    "--y": `${n.y}%`,
                    "--mx": `${n.mx}%`,
                    "--my": `${n.my}%`,
                    "--d": `${200 + i * 90}ms`,
                  } as CSSProperties
                }
                className={cn(
                  "absolute top-[var(--my)] left-[var(--mx)] size-0 md:top-[var(--y)] md:left-[var(--x)]",
                  !n.m && "hidden md:block",
                )}
              >
                <div
                  className={cn(
                    "landing-tile bg-card absolute top-0 left-0 w-max -translate-x-1/2 -translate-y-1/2 rounded-xl border px-3 py-2 text-left md:px-4 md:py-2.5",
                    FLOAT_SHADOW,
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_oklab,var(--brand)_12%,transparent)] text-[var(--brand)] sm:size-9">
                      <n.Icon className="size-4 sm:size-[1.15rem]" strokeWidth={2} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold whitespace-nowrap">{n.label}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <h1
            className={cn(
              DISPLAY,
              "landing-blur mx-auto max-w-4xl text-5xl leading-[1.04] font-extrabold tracking-[-0.035em] text-balance sm:text-6xl md:text-7xl",
            )}
          >
            Semua lamaran kerjamu, rapi di satu tempat.
          </h1>
          <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg text-pretty">
            Catat tahap seleksi dari administrasi sampai offering, jangan lagi lupa deadline dan jadwal tes, dan ketahui
            versi CV mana yang paling sering lolos.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="rounded-full">
              <Link href="/login">Mulai gratis</Link>
            </Button>
            {demo && <DemoButton />}
          </div>
          <p className="text-muted-foreground mt-3 text-xs">Masuk dengan Google. Tanpa biaya, tanpa iklan.</p>
        </section>

        {/* Product shot: the real dashboard, in the frame that lifts it off the page */}
        <section className="mx-auto max-w-6xl px-4" aria-label="Tampilan aplikasi">
          <figure>
            {/* Light and dark shots; CSS shows the one for the current theme, and the hidden (lazy) one never loads. */}
            <div className={cn("bg-card rounded-3xl border p-2 md:p-3", FLOAT_SHADOW)}>
              <Image
                src="/landing/dashboard.png"
                alt="Dashboard Lajur: jadwal 7 hari ke depan, lamaran yang perlu di-follow-up, dan pipeline tahap seleksi"
                width={1440}
                height={900}
                className="w-full rounded-2xl border dark:hidden"
              />
              <Image
                src="/landing/dashboard-dark.png"
                alt="Dashboard Lajur: jadwal 7 hari ke depan, lamaran yang perlu di-follow-up, dan pipeline tahap seleksi"
                width={1440}
                height={900}
                className="hidden w-full rounded-2xl border dark:block"
              />
            </div>
            <figcaption className="text-muted-foreground mt-3 text-center text-xs">
              Dashboard Lajur dengan data contoh.
            </figcaption>
          </figure>
        </section>

        {/* Pieces of the app floating around one heading */}
        <section id="fitur" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-24">
          <div className="md:relative md:h-[36rem]">
            <div className="mx-auto max-w-md text-center md:absolute md:inset-0 md:flex md:max-w-none md:flex-col md:items-center md:justify-center">
              <h2 data-lm="heading" className={cn(H2, "max-w-sm md:text-4xl")}>
                <Words>Semua yang kamu butuhkan selama mencari kerja</Words>
              </h2>
              <p className="text-muted-foreground mt-4 max-w-xs">
                Bukan spreadsheet lagi. Dibuat untuk dipakai setiap hari, di laptop maupun HP.
              </p>
              <Button asChild className="mt-6 rounded-full" size="lg">
                <a href="#cara-kerja">Lihat cara kerjanya</a>
              </Button>
            </div>
            <div className="mt-10 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 md:mt-0 md:block">
              {FLOATS.map(({ Card, l, t, r }) => (
                <div
                  key={`${l}-${t}`}
                  data-lm="float"
                  style={{ "--l": `${l}%`, "--t": `${t}%`, "--r": `${r}deg` } as CSSProperties}
                  className="md:absolute md:top-[var(--t)] md:left-[var(--l)] md:w-56 md:rotate-[var(--r)]"
                >
                  <Card />
                </div>
              ))}
            </div>
          </div>
          <p className="text-muted-foreground mt-6 text-center text-xs">
            Isi kartu di atas adalah contoh. Datamu sendiri muncul setelah masuk.
          </p>
        </section>

        {/* Who it is for: example UI on top, the words below */}
        <section id="untuk-siapa" className="mx-auto max-w-6xl px-4 pb-24">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 data-lm="heading" className={H2}>
              <Words>Dibuat untuk semua jenis pelamar</Words>
            </h2>
            <p className="text-muted-foreground mt-4">
              Dari yang melamar puluhan tempat sekaligus sampai yang mengejar satu formasi BUMN.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <article data-lm="rise" className={bento}>
              <SourceTable className="border-0 p-0 shadow-none" />
              <div>
                <h3 className={cn(DISPLAY, "text-xl font-bold tracking-tight")}>Pelamar banyak sekaligus</h3>
                <p className="text-muted-foreground mt-1.5 text-sm">
                  Lihat sumber lowongan dan versi CV mana yang paling sering lolos administrasi, dan tahap mana yang
                  paling sering membuat gagal.
                </p>
              </div>
            </article>
            <article data-lm="rise" className={bento}>
              <RequirementList />
              <div>
                <h3 className={cn(DISPLAY, "text-xl font-bold tracking-tight")}>Pemburu BUMN dan CPNS</h3>
                <p className="text-muted-foreground mt-1.5 text-sm">
                  IPK, batas usia, jurusan, penempatan, dan ikatan dinas dicocokkan otomatis dengan profilmu, tanpa AI.
                </p>
              </div>
            </article>
            <article data-lm="rise" className={bento}>
              <ReminderList />
              <div>
                <h3 className={cn(DISPLAY, "text-xl font-bold tracking-tight")}>Yang sering lupa jadwal</h3>
                <p className="text-muted-foreground mt-1.5 text-sm">
                  Pengingat email H-3 dan H-1 untuk tes dan interview, follow-up yang jatuh tempo, dan sekali klik ke
                  Google Calendar.
                </p>
              </div>
            </article>
            <article data-lm="rise" className={cn(bento, "md:col-span-2")}>
              <ApplicationTable />
              <div>
                <h3 className={cn(DISPLAY, "text-xl font-bold tracking-tight")}>Semua lamaran di satu tempat</h3>
                <p className="text-muted-foreground mt-1.5 max-w-xl text-sm">
                  Tahap, versi CV, deadline, dan catatan pertanyaan wawancara tercatat. Tambah lamaran dengan AI yang
                  membaca teks lowongan, lengkap dengan kutipan bukti. Unduh semuanya sebagai CSV kapan saja.
                </p>
              </div>
            </article>
            <article data-lm="rise" id="privasi" className={cn(bento, "scroll-mt-24")}>
              <ul className="space-y-3">
                {PRIVACY.map((p) => (
                  <li key={p} className="flex gap-3 text-sm">
                    <span
                      aria-hidden
                      className="bg-muted mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md"
                    >
                      <Check className="size-3.5" strokeWidth={3} />
                    </span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
              <div>
                <h3 className={cn(DISPLAY, "text-xl font-bold tracking-tight")}>CV dan data pribadimu tetap milikmu</h3>
              </div>
            </article>
          </div>
        </section>

        {/* Portals: tilted tiles for the four portals the search feature opens */}
        <section className="mx-auto max-w-6xl px-4 pb-24">
          <div
            data-lm="portal-panel"
            className="bg-card overflow-hidden rounded-[2rem] border px-4 py-12 text-center md:py-16"
          >
            <div className="mx-auto max-w-2xl">
              <h2 data-lm="heading" className={H2}>
                <Words>Dari CV ke pencarian di portal favoritmu</Words>
              </h2>
              <p className="text-muted-foreground mt-4">
                Lajur menyusun kata kunci dari CV-mu, lalu membuka pencarian di portal ini. Lowongannya tetap tampil di
                portalnya, bukan disalin ke Lajur.
              </p>
            </div>
            <ul className="mx-auto mt-14 flex max-w-3xl items-end justify-center gap-2 sm:gap-6">
              {PORTALS.map((p) => (
                <li
                  key={p.id}
                  data-lm="portal-tile"
                  className={cn("flex w-1/4 flex-col items-center", p.big ? "-translate-y-3" : "translate-y-2")}
                >
                  <div
                    data-lm="portal-box"
                    style={{ "--r": `${p.r}deg` } as CSSProperties}
                    className="bg-background grid aspect-square w-full rotate-[var(--r)] place-items-center rounded-2xl border sm:rounded-3xl"
                  >
                    <Image
                      src={`/portals/${p.id}.${p.ext}`}
                      alt=""
                      width={192}
                      height={192}
                      unoptimized
                      className="size-[55%] rounded-xl object-contain"
                    />
                  </div>
                  <p data-lm="portal-name" className="mt-4 text-sm font-semibold sm:mt-5">
                    {p.name}
                  </p>
                  <p className="text-muted-foreground text-xs">{p.note}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How it works: the video, then the steps as three slightly tilted cards */}
        <section id="cara-kerja" className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-24">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 data-lm="heading" className={H2}>
              <Words>Cara kerjanya</Words>
            </h2>
          </div>
          <div className="bg-card mx-auto max-w-3xl rounded-3xl border p-2">
            <HowItWorksVideo />
          </div>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li
                key={s.title}
                data-lm="rise"
                style={{ "--r": `${s.r}deg` } as CSSProperties}
                className={cn("bg-card rounded-2xl border p-5 md:rotate-[var(--r)]", FLOAT_SHADOW)}
              >
                <span aria-hidden className={cn(DISPLAY, "text-muted-foreground text-3xl leading-none font-extrabold")}>
                  {i + 1}
                </span>
                <h3 className="mt-3 font-semibold tracking-tight">{s.title}</h3>
                <p className="text-muted-foreground mt-1 text-sm">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Final call */}
        <section className="mx-auto max-w-6xl px-4 pb-16 text-center">
          <h2 data-lm="heading" className={cn(H2, "mx-auto max-w-3xl md:text-6xl")}>
            <Words>Lamaran berikutnya, kali ini tercatat rapi.</Words>
          </h2>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="rounded-full">
              <Link href="/login">Mulai gratis</Link>
            </Button>
            {demo && <DemoButton />}
          </div>
        </section>
      </main>

      {/* Footer card: links, and the wordmark cropped by the card's bottom edge */}
      <footer className="px-4 pb-4">
        <div className="bg-card mx-auto max-w-6xl overflow-hidden rounded-[2rem] border">
          <div className="grid gap-8 p-6 md:grid-cols-[1.4fr_1fr_1fr] md:p-10">
            <div>
              <Logo className="text-base" markClassName="size-5" />
              <p className="mt-3 max-w-xs text-sm">
                Tracker lamaran kerja untuk pencari kerja di Indonesia: tahap seleksi, jadwal, dan versi CV di satu
                tempat.
              </p>
            </div>
            <nav aria-label="Halaman" className="text-sm">
              <p className="text-muted-foreground mb-1 text-xs">Halaman</p>
              <a href="#fitur" className="hover:text-foreground block py-2">
                Fitur
              </a>
              <a href="#cara-kerja" className="hover:text-foreground block py-2">
                Cara kerja
              </a>
              <a href="#privasi" className="hover:text-foreground block py-2">
                Privasi
              </a>
            </nav>
            <nav aria-label="Akun" className="text-sm">
              <p className="text-muted-foreground mb-1 text-xs">Akun</p>
              <Link href="/login" className="hover:text-foreground block py-2">
                Masuk
              </Link>
              <Link href="/donasi" className="hover:text-foreground block py-2">
                Donasi
              </Link>
            </nav>
          </div>
          <p
            aria-hidden
            data-lm="wordmark"
            className={cn(
              DISPLAY,
              "pointer-events-none mt-4 translate-y-[16%] text-center text-[32vw] leading-[0.8] font-extrabold tracking-[-0.06em] text-[var(--brand)] select-none md:text-[19rem]",
            )}
          >
            Lajur
          </p>
        </div>
      </footer>
    </div>
  );
}
