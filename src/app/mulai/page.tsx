import { ArrowLeft, BellRing, CircleCheck, KanbanSquare } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NewApplicationSection } from "@/components/application/new-application-section";
import { Logo } from "@/components/logo";
import { CvStep, ProfileStep, TemplateStep } from "@/components/onboarding/steps";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { toDateInput } from "@/lib/dates";
import { db } from "@/lib/db";
import { isDemoEmail } from "@/lib/demo";

export const metadata = { title: "Mulai · Lajur" };

const STEPS = [
  { title: "Selamat datang di Lajur", hint: "" },
  {
    title: "Ceritakan sedikit tentang kamu",
    hint: "Dipakai untuk mengecek apakah kamu memenuhi syarat lowongan (IPK, usia, jurusan, pendidikan).",
  },
  {
    title: "Lowongan seperti apa yang kamu lamar?",
    hint: "Kolom di board kamu disusun dari tahap seleksi yang biasa dipakai jenis lowongan ini.",
  },
  {
    title: "Upload CV kamu",
    hint: "Lajur mencatat versi CV mana yang dikirim ke tiap lowongan, dan bisa mengecek CV terhadap syarat lowongan.",
  },
  {
    title: "Tambahkan lamaran pertamamu",
    hint: "Tempel teks lowongan, link-nya, atau screenshot posternya. AI mengisi form-nya, kamu tinggal meninjau.",
  },
];

/**
 * New-user wizard. Steps 1–4 come before the app opens (the app layout sends un-onboarded users here); "Nanti saja"
 * or uploading a CV marks the user onboarded and leads to step 5, the optional first application.
 */
export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const user = await requireUser();
  if (isDemoEmail(user.email)) redirect("/dashboard");
  const profile = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { onboardedAt: true, gpa: true, birthDate: true, major: true, degree: true, domicile: true },
  });
  const raw = Number((await searchParams).step);
  const current = Number.isInteger(raw) && raw >= 1 && raw <= STEPS.length ? raw : 1;
  // Step 5 only after the required part; once onboarded, the earlier steps live in Settings.
  if (profile.onboardedAt && current !== 5) redirect("/board");
  if (!profile.onboardedAt && current === 5) redirect("/mulai?step=4");
  const { title, hint } = STEPS[current - 1];

  return (
    <div className="mx-auto flex min-h-svh max-w-3xl flex-col gap-6 p-4 md:p-8">
      <header className="flex items-center justify-between gap-4">
        <Logo className="text-xl" markClassName="size-7" />
        <span className="text-muted-foreground text-sm tabular-nums">
          Langkah {current} dari {STEPS.length}
        </span>
      </header>
      <ol className="flex gap-1.5" aria-label="Progres">
        {STEPS.map((s, i) => (
          <li
            key={s.title}
            aria-current={i + 1 === current ? "step" : undefined}
            className={i < current ? "bg-primary h-1.5 flex-1 rounded-full" : "bg-muted h-1.5 flex-1 rounded-full"}
          />
        ))}
      </ol>

      <main className="space-y-6">
        <div className="space-y-1.5">
          {/* Step 5 comes after the point of no return (onboarded), so it has no way back. */}
          {current > 1 && current < 5 && (
            <Link
              href={`/mulai?step=${current - 1}`}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
            >
              <ArrowLeft className="size-4" /> Kembali
            </Link>
          )}
          <h1 className="text-2xl font-semibold tracking-tight">
            {current === 1 && user.name ? `Halo, ${user.name.split(" ")[0]}!` : title}
          </h1>
          {hint && <p className="text-muted-foreground max-w-xl text-sm">{hint}</p>}
        </div>

        {current === 1 && (
          <div className="space-y-6">
            <p className="text-muted-foreground max-w-xl">
              Lajur membantu kamu melacak semua lamaran kerja di satu tempat. Siapkan akunmu dulu, cuma beberapa menit.
            </p>
            <ul className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: KanbanSquare, text: "Semua lamaran di satu board, dari daftar sampai offering." },
                { icon: CircleCheck, text: "Cek otomatis apakah kamu memenuhi syarat IPK, usia, dan jurusan." },
                { icon: BellRing, text: "Email pengingat H-3 dan H-1 sebelum tes atau interview." },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="glass space-y-2 rounded-2xl border p-4 text-sm">
                  <Icon className="text-primary size-5" aria-hidden />
                  <p>{text}</p>
                </li>
              ))}
            </ul>
            <Button asChild size="lg">
              <Link href="/mulai?step=2">Mulai (±3 menit)</Link>
            </Button>
          </div>
        )}
        {current === 2 && (
          <div className="glass rounded-2xl border p-4">
            <ProfileStep
              defaults={{
                gpa: profile.gpa?.toFixed(2) ?? "",
                birthDate: toDateInput(profile.birthDate),
                major: profile.major ?? "",
                degree: profile.degree ?? "",
                domicile: profile.domicile ?? "",
              }}
            />
          </div>
        )}
        {current === 3 && <TemplateStep />}
        {current === 4 && <CvStep />}
        {current === 5 && (
          <div className="space-y-4">
            <NewApplicationSection />
            <div className="flex justify-end">
              <Button asChild variant="link">
                <Link href="/board">Nanti saja, ke board</Link>
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
