import { CalendarClock, FileText, KanbanSquare, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { redirect } from "next/navigation";
import { signInAsDemo } from "@/actions/demo";
import { Button } from "@/components/ui/button";
import { auth, signIn } from "@/lib/auth";
import { demoLoginEnabled } from "@/lib/demo";

export const metadata = { title: "Masuk · Lamarin" };

const VALUE_PROPS = [
  { icon: KanbanSquare, title: "Board tahap seleksi", text: "Dari administrasi sampai offering, geser kartu saat lamaranmu maju." },
  { icon: CalendarClock, title: "Deadline dan tes tidak terlupa", text: "Pengingat email H-3 dan H-1 untuk setiap jadwal." },
  { icon: FileText, title: "Tahu CV mana dikirim ke mana", text: "Simpan versi CV dan lihat versi mana yang paling sering lolos." },
  { icon: ShieldCheck, title: "Cek syarat otomatis", text: "IPK, usia, dan jurusan dicocokkan dengan profilmu." },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if ((await auth())?.user) redirect("/board");
  const { error } = await searchParams;

  return (
    <main className="mx-auto grid min-h-svh max-w-5xl items-center gap-10 p-4 py-10 lg:grid-cols-[1fr_22rem] lg:gap-16">
      <div className="space-y-8">
        <div className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight">
            <Link href="/" className="hover:opacity-80" aria-label="Lamarin, beranda">
              <Logo className="gap-3" markClassName="size-10" />
            </Link>
          </h1>
          <p className="text-muted-foreground max-w-md text-lg">
            Catat semua lamaran kerja, deadline, dan tahap seleksi di satu tempat.
          </p>
        </div>
        <ul className="grid gap-5 sm:grid-cols-2">
          {VALUE_PROPS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3">
              <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                <Icon className="size-5" />
              </span>
              <div>
                <p className="font-medium">{title}</p>
                <p className="text-muted-foreground text-sm">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="glass space-y-4 rounded-3xl border p-6 text-center">
        <h2 className="text-xl font-semibold tracking-tight">Masuk</h2>
        <div className="space-y-2">
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/board" });
            }}
          >
            <Button type="submit" size="lg" className="w-full">
              Masuk dengan Google
            </Button>
          </form>
          {demoLoginEnabled() && (
            <form action={signInAsDemo}>
              <Button type="submit" size="lg" variant="outline" className="w-full">
                Masuk sebagai demo
              </Button>
            </form>
          )}
        </div>
        {demoLoginEnabled() && (
          <p className="text-muted-foreground text-xs">
            Akun demo berisi contoh lamaran supaya kamu bisa melihat board, dashboard, dan kalender tanpa mendaftar.
          </p>
        )}
        {error === "demo" && <p className="text-destructive text-sm">Akun demo belum tersedia.</p>}
      </div>
    </main>
  );
}
