"use client";

import { CalendarDays, FileText, KanbanSquare, LayoutDashboard, Plus, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/board", label: "Lamaran", icon: KanbanSquare, also: "/applications" },
  { href: "/applications/new", label: "Lamaran baru", icon: Plus },
  { href: "/calendar", label: "Kalender", icon: CalendarDays },
  { href: "/resumes", label: "CV", icon: FileText },
  { href: "/settings", label: "Pengaturan", icon: Settings },
];

const LINK_ALSO: Record<string, string | undefined> = Object.fromEntries(LINKS.map((l) => [l.href, l.also]));

const isActive = (pathname: string, href: string) => {
  if (pathname === "/applications/new") return href === "/applications/new";
  const also = LINK_ALSO[href];
  return pathname === href || pathname.startsWith(`${href}/`) || (!!also && (pathname === also || pathname.startsWith(`${also}/`)));
};

/** Desktop sidebar navigation. */
export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1" aria-label="Navigasi utama">
      {LINKS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(pathname, href) ? "page" : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground",
            isActive(pathname, href) && "bg-primary/10 font-medium text-primary hover:bg-primary/10 hover:text-primary",
          )}
        >
          <Icon className="size-4" /> {label}
        </Link>
      ))}
    </nav>
  );
}

/** Phone navigation: a fixed bottom tab bar (thumb reach), with "new application" as the centre action. */
export function TabBar() {
  const pathname = usePathname();
  const tabs = LINKS.filter((l) => l.href !== "/settings");
  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          const primary = href === "/applications/new";
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] text-muted-foreground transition-transform active:scale-95",
                  active && "font-medium text-primary",
                )}
              >
                {primary ? (
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                    <Icon className="size-5" />
                  </span>
                ) : (
                  <Icon className={cn("size-5", active && "stroke-[2.5]")} />
                )}
                <span className={cn(primary && "sr-only")}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
