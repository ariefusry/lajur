import { ArrowLeft, Download, Heart, ScanLine, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Dukung Lajur · Donasi",
  description: "Lajur gratis untuk semua pencari kerja. Dukung lewat donasi QRIS.",
};

const STEPS = [
  { icon: Wallet, text: "Buka aplikasi bank atau e-wallet yang mendukung QRIS." },
  { icon: ScanLine, text: "Scan kodenya. Di HP, simpan gambarnya dulu lalu pilih dari galeri." },
  { icon: Heart, text: "Isi nominal sesukamu. Pastikan penerimanya ZONDER, SOFTWARE." },
];

// Public, so the landing page can link here too; signed-in users go back to the app.
export default async function DonatePage() {
  const signedIn = !!(await auth())?.user;
  const home = signedIn ? "/dashboard" : "/";

  return (
    <div className="min-h-svh">
      <header className="bg-background/70 sticky top-0 z-30 border-b backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href={home} aria-label="Lajur">
            <Logo className="text-lg" markClassName="size-6" />
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm">
              <Link href={home}>
                <ArrowLeft /> {signedIn ? "Ke aplikasi" : "Beranda"}
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl items-center gap-10 px-4 py-10 lg:min-h-[calc(100svh-3.5rem)] lg:grid-cols-[1fr_22rem] lg:gap-16">
        <div className="space-y-8">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Dukung Lajur</h1>
            <p className="text-muted-foreground max-w-md text-lg">
              Lajur gratis untuk semua pencari kerja. Donasi berapa pun membantu biaya server dan pengembangan fitur
              baru.
            </p>
          </div>
          <ol className="space-y-5">
            {STEPS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                  <Icon className="size-5" />
                </span>
                <p className="text-sm">{text}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="glass space-y-4 rounded-3xl border p-6 text-center">
          <h2 className="text-xl font-semibold tracking-tight">QRIS</h2>
          <Image
            src="/donasi/qris.png"
            alt="QRIS untuk donasi ke Lajur"
            width={764}
            height={772}
            sizes="(min-width: 1024px) 304px, 280px"
            priority
            className="mx-auto h-auto w-full max-w-72 rounded-2xl border bg-white p-2"
          />
          <p className="text-muted-foreground text-xs">ZONDER, SOFTWARE · nominal bebas</p>
          <Button asChild variant="outline" size="lg" className="w-full">
            <a href="/donasi/qris.png" download="qris-lajur.png">
              <Download /> Simpan gambar QRIS
            </a>
          </Button>
        </div>
      </main>
    </div>
  );
}
