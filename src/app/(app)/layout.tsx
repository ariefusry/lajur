import { Heart, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { NavLinks, TabBar } from "@/components/nav-links";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";
import { requireUser, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { isDemoEmail, isReadOnly } from "@/lib/demo";

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const isDemo = isDemoEmail(user.email);
  // New users go through the /mulai wizard first (the demo account never does).
  if (!isDemo) {
    const { onboardedAt } = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { onboardedAt: true } });
    if (!onboardedAt) redirect("/mulai");
  }

  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="bg-sidebar sticky top-0 hidden h-svh w-56 shrink-0 flex-col gap-4 border-r p-4 backdrop-blur-xl backdrop-saturate-150 md:flex">
        <Link href="/dashboard" aria-label="Lajur, ke dashboard" className="px-1">
          <Logo className="text-xl" markClassName="size-7" />
        </Link>
        <NavLinks />
        <div className="mt-auto space-y-2">
          <p className="text-muted-foreground truncate text-xs" title={user.email ?? ""}>
            {user.name ?? user.email}
          </p>
          <Button asChild variant="ghost" size="sm" className="w-full justify-start">
            <Link href="/donasi">
              <Heart className="text-rose-500" /> Dukung Lajur
            </Link>
          </Button>
          <ThemeToggle withLabel />
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="sm" className="w-full justify-start">
              <LogOut /> Keluar
            </Button>
          </form>
        </div>
      </aside>

      {/* Phone header: brand + the items that don't fit the tab bar */}
      <header className="bg-background/80 sticky top-0 z-30 flex h-12 items-center justify-between border-b px-4 backdrop-blur-xl md:hidden">
        <Link href="/dashboard" aria-label="Lajur, ke dashboard">
          <Logo markClassName="size-5" />
        </Link>
        <div className="flex items-center">
          <Button asChild variant="ghost" size="icon-sm" aria-label="Dukung Lajur" className="hover:text-rose-500">
            <Link href="/donasi">
              <Heart />
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

      <main className="min-w-0 flex-1 p-4 pb-36 md:p-6 md:pb-6">
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
