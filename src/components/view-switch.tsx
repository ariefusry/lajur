import { KanbanSquare, List } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const VIEWS = [
  { key: "board", href: "/board", label: "Board", icon: KanbanSquare },
  { key: "list", href: "/applications", label: "Daftar", icon: List },
] as const;

/** Segmented control between the kanban board and the full list of applications. */
export function ViewSwitch({ active }: { active: "board" | "list" }) {
  return (
    <nav aria-label="Tampilan lamaran" className="bg-foreground/5 inline-flex rounded-lg p-0.5">
      {VIEWS.map(({ key, href, label, icon: Icon }) => (
        <Link
          key={key}
          href={href}
          aria-current={key === active ? "page" : undefined}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors pointer-coarse:py-2.5",
            key === active ? "bg-card font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="size-4" aria-hidden /> {label}
        </Link>
      ))}
    </nav>
  );
}
