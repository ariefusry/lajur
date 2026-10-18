import { BarChart3, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { NavLinks, TabBar } from "@/components/nav-links";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { requireUser, signOut } from "@/lib/auth";
import { isDemoEmail, isReadOnly } from "@/lib/demo";

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const isDemo = isDemoEmail(user.email);

  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-svh w-56 shrink-0 flex-col gap-4 border-r bg-sidebar p-4 backdrop-blur-xl backdrop-saturate-150 md:flex">
        <Link href="/dashboard" aria-label="Lajur, ke dashboard" className="px-1">
          <Logo className="text-xl" markClassName="size-7" />
        </Link>
        <NavLinks />
        <div className="mt-auto space-y-2">
          <p className="truncate text-xs text-muted-foreground" title={user.email ?? ""}>
            {user.name ?? user.email}
          </p>
          <ThemeToggle withLabel />
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="sm" className="w-full justify-start">
              <LogOut /> Keluar
            </Button>
          </form>
        </div>
      </aside>

      {/* Phone header: brand + the two items that don't fit the tab bar */}
      <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-xl md:hidden">
        <Link href="/dashboard" aria-label="Lajur, ke dashboard">
          <Logo markClassName="size-5" />
        </Link>
        <div className="flex items-center">
          <Button asChild variant="ghost" size="icon-sm" aria-label="Analytics">
            <Link href="/analytics">
              <BarChart3 />
            </Link>
          </Button>
          <ThemeToggle />
          <Button asChild variant="ghost" size="icon-sm" aria-label="Pengaturan">
            <Link href="/settings">
              <Settings />
            </Link>
          </Button>
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="icon-sm" aria-label="Keluar">
              <LogOut />
            </Button>
          </form>
        </div>
      </header>

      <main className="min-w-0 flex-1 p-4 pb-24 md:p-6 md:pb-6">
        {isDemo && (
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-900 dark:text-amber-200">
            <span>
              <span className="font-medium">Mode demo</span>
              {isReadOnly(user) && " · hanya bisa dilihat"}
            </span>
            <form action={signOutAction} className="ml-auto">
              <button type="submit" className="font-medium underline underline-offset-2 hover:no-underline">
                Masuk dengan Google
              </button>
            </form>
          </div>
        )}
        {children}
      </main>

      <TabBar />
    </div>
  );
}
