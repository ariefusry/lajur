import { LogOut } from "lucide-react";
import { NavLinks } from "@/components/nav-links";
import { Button } from "@/components/ui/button";
import { requireUser, signOut } from "@/lib/auth";
import { DEMO_EMAIL, isReadOnly } from "@/lib/demo";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col gap-4 border-b bg-muted/30 p-4 md:w-56 md:border-r md:border-b-0">
        <span className="text-lg font-semibold">Lamarin</span>
        <NavLinks />
        <div className="mt-auto flex items-center justify-between gap-2 md:block md:space-y-2">
          <p className="truncate text-xs text-muted-foreground" title={user.email ?? ""}>
            {user.name ?? user.email}
          </p>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button type="submit" variant="ghost" size="sm" className="w-full justify-start">
              <LogOut /> Keluar
            </Button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-6">
        {user.email === DEMO_EMAIL && (
          <p className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
            Kamu sedang melihat akun demo{isReadOnly(user) ? ": semua data hanya bisa dilihat, perubahan tidak disimpan" : ""}.
            Keluar lalu masuk dengan Google untuk mencatat lamaranmu sendiri.
          </p>
        )}
        {children}
      </main>
    </div>
  );
}
