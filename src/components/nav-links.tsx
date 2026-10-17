"use client";

import { CalendarDays, FileText, KanbanSquare, LayoutDashboard, Plus, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/board", label: "Board", icon: KanbanSquare },
  { href: "/applications/new", label: "Lamaran baru", icon: Plus },
  { href: "/calendar", label: "Kalender", icon: CalendarDays },
  { href: "/resumes", label: "CV", icon: FileText },
  { href: "/settings", label: "Pengaturan", icon: Settings },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col">
      {LINKS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? "page" : undefined}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap hover:bg-muted",
            pathname === href && "bg-muted font-medium",
          )}
        >
          <Icon className="size-4" /> {label}
        </Link>
      ))}
    </nav>
  );
}
