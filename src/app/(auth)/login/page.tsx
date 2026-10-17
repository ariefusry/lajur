import { redirect } from "next/navigation";
import { signInAsDemo } from "@/actions/demo";
import { Button } from "@/components/ui/button";
import { auth, signIn } from "@/lib/auth";
import { demoLoginEnabled } from "@/lib/demo";

export const metadata = { title: "Masuk · Lamarin" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if ((await auth())?.user) redirect("/board");
  const { error } = await searchParams;

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Lamarin</h1>
          <p className="text-sm text-muted-foreground">
            Catat semua lamaran kerja, deadline, dan tahap seleksi di satu tempat.
          </p>
        </div>
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
          <p className="text-xs text-muted-foreground">
            Akun demo berisi 15 contoh lamaran supaya kamu bisa melihat board, dashboard, dan kalender tanpa mendaftar.
          </p>
        )}
        {error === "demo" && <p className="text-sm text-destructive">Akun demo belum tersedia.</p>}
      </div>
    </main>
  );
}
