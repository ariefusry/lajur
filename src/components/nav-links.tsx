"use client";

import { BarChart3, CalendarDays, FileText, KanbanSquare, LayoutDashboard, Plus, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    href: "/board",
    label: "Lamaran",
    icon: KanbanSquare,
    also: "/applications",
    // Desktop sub-menu; the phone tab bar keeps the single "Lamaran" tab.
    sub: [
      { href: "/board", label: "Lihat lamaran" },
      { href: "/applications/update", label: "Update dari email" },
    ],
  },
  { href: "/applications/new", label: "Lamaran baru", icon: Plus },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/calendar", label: "Kalender", icon: CalendarDays },
  { href: "/resumes", label: "CV", icon: FileText },
  { href: "/settings", label: "Pengaturan", icon: Settings },
];

const LINK_ALSO: Record<string, string | undefined> = Object.fromEntries(LINKS.map((l) => [l.href, l.also]));

const isActive = (pathname: string, href: string) => {
  if (pathname === "/applications/new") return href === "/applications/new";
  const also = LINK_ALSO[href];
  return (
    pathname === href ||
    pathname.startsWith(`${href}/`) ||
    (!!also && (pathname === also || pathname.startsWith(`${also}/`)))
  );
};

// "Update dari email" lives under /applications but has its own sub-menu entry.
const isSubActive = (pathname: string, href: string) =>
  href === "/applications/update" ? pathname === href : pathname !== "/applications/update" && isActive(pathname, href);

const linkClass = (active: boolean) =>
  cn(
    "text-muted-foreground hover:bg-foreground/5 hover:text-foreground flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
    active && "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary font-medium",
  );

/** Desktop sidebar navigation. */
export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1" aria-label="Navigasi utama">
      {LINKS.map(({ href, label, icon: Icon, sub }) =>
        sub ? (
          <div key={href} className="flex flex-col gap-1">
            <span className="text-muted-foreground flex items-center gap-2.5 px-3 py-2 text-sm">
              <Icon className="size-4" /> {label}
            </span>
            {sub.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                aria-current={isSubActive(pathname, s.href) ? "page" : undefined}
                className={cn(linkClass(isSubActive(pathname, s.href)), "pl-9.5")}
              >
                {s.label}
              </Link>
            ))}
          </div>
        ) : (
          <Link
            key={href}
            href={href}
            aria-current={isActive(pathname, href) ? "page" : undefined}
            className={linkClass(isActive(pathname, href))}
          >
            <Icon className="size-4" /> {label}
          </Link>
        ),
      )}
    </nav>
  );
}

/** Phone navigation: a fixed bottom tab bar (thumb reach), plus a floating "new application" button above it. */
export function TabBar() {
  const pathname = usePathname();
  // Five tabs max: Settings sits in the header, "Lamaran baru" is the floating button.
  const tabs = LINKS.filter((l) => l.href !== "/settings" && l.href !== "/applications/new");
  return (
    <>
      {pathname !== "/applications/new" && (
        <Link
          href="/applications/new"
          aria-label="Lamaran baru"
          className="bg-primary text-primary-foreground fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 flex size-14 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95 md:hidden"
        >
          <Plus className="size-6" />
        </Link>
      )}
      <nav
        aria-label="Navigasi utama"
        data-tab-bar
        className="bg-background/80 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 md:hidden"
      >
        <ul className="mx-auto grid max-w-md grid-cols-5">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "text-muted-foreground flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] transition-transform active:scale-95",
                    active && "text-primary font-medium",
                  )}
                >
                  <Icon className={cn("size-5", active && "stroke-[2.5]")} />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
