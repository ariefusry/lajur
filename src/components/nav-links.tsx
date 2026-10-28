"use client";

import { BarChart3, CalendarDays, FileText, KanbanSquare, LayoutDashboard, Plus, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SegmentedNav } from "@/components/ui/segmented-nav";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    href: "/board",
    label: "Lamaran",
    icon: KanbanSquare,
    also: ["/applications", "/jobs"],
    // Desktop sub-menu; on phones the same entries sit atop the section's pages (LamaranSubNav).
    sub: [
      { href: "/board", label: "Lihat lamaran", short: "Lamaran" },
      { href: "/applications/update", label: "Update dari email", short: "Update email" },
      { href: "/jobs", label: "Cari lowongan", short: "Lowongan" },
    ],
  },
  { href: "/applications/new", label: "Lamaran baru", icon: Plus },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/calendar", label: "Kalender", icon: CalendarDays },
  { href: "/resumes", label: "CV", icon: FileText },
  { href: "/settings", label: "Pengaturan", icon: Settings },
];

const LINK_ALSO: Record<string, string[] | undefined> = Object.fromEntries(LINKS.map((l) => [l.href, l.also]));

const isActive = (pathname: string, href: string) => {
  if (pathname === "/applications/new") return href === "/applications/new";
  const also = LINK_ALSO[href];
  return (
    pathname === href ||
    pathname.startsWith(`${href}/`) ||
    !!also?.some((a) => pathname === a || pathname.startsWith(`${a}/`))
  );
};

// "Update dari email" and "Cari lowongan" have their own sub-menu entries; "Lihat lamaran" is everything else.
const OWN_SUB_PAGES = ["/applications/update", "/jobs"];
const isSubActive = (pathname: string, href: string) =>
  OWN_SUB_PAGES.includes(href) ? pathname === href : !OWN_SUB_PAGES.includes(pathname) && isActive(pathname, href);

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
          <div key={href} className="flex flex-col">
            <Link
              href={href}
              aria-expanded={isActive(pathname, href)}
              className={cn(linkClass(false), isActive(pathname, href) && "text-foreground font-medium")}
            >
              <Icon className="size-4" /> {label}
            </Link>
            {/* Opens only inside the section; the line joins the two entries to their parent. */}
            <div
              inert={!isActive(pathname, href)}
              className={cn(
                "grid transition-[grid-template-rows] duration-200",
                isActive(pathname, href) ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden">
                <div className="border-border ml-5 flex flex-col gap-1 border-l pt-1 pl-2">
                  {sub.map((s) => (
                    <Link
                      key={s.href}
                      href={s.href}
                      aria-current={isSubActive(pathname, s.href) ? "page" : undefined}
                      className={linkClass(isSubActive(pathname, s.href))}
                    >
                      {s.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
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

/** Phone version of the "Lamaran" sub-menu: segments at the top of the board, list, email-update and job-search pages. */
export function LamaranSubNav() {
  const pathname = usePathname();
  const sub = LINKS.find((l) => l.sub)!.sub!;
  return (
    <SegmentedNav
      items={sub}
      active={Math.max(
        0,
        sub.findIndex((s) => isSubActive(pathname, s.href)),
      )}
      label="Menu lamaran"
      fill
      className="w-full md:hidden"
    />
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
