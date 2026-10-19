"use client";

import { KanbanSquare, List } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import ButtonGroup, { buttonGroupItemClass } from "@/components/ui/primitive-button-group";
import { cn } from "@/lib/utils";

const VIEWS = [
  { key: "board", href: "/board", label: "Board", icon: KanbanSquare },
  { key: "list", href: "/applications", label: "Daftar", icon: List },
] as const;

type View = (typeof VIEWS)[number]["key"];

/**
 * Segmented control between the kanban board and the full list. It lives in the shared layout, so it stays
 * mounted across the switch and the raised pill slides instead of jumping. A click moves the pill right away;
 * the pathname takes over once the navigation lands.
 */
export function ViewSwitch() {
  const pathname = usePathname();
  const [clicked, setClicked] = useState<{ view: View; from: string } | null>(null);
  const active: View = clicked?.from === pathname ? clicked.view : pathname.startsWith("/board") ? "board" : "list";

  return (
    <ButtonGroup role="navigation" aria-label="Tampilan lamaran" className="relative inline-grid grid-cols-2 p-1">
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-1 left-1 w-[calc(50%-0.375rem)] bg-[var(--bjork-field)] shadow-[var(--bjork-shadow-raised)] transition-transform duration-300 ease-out motion-reduce:transition-none",
          active === "list" && "translate-x-[calc(100%+0.25rem)]",
        )}
      />
      {VIEWS.map(({ key, href, label, icon: Icon }) => (
        <Link
          key={key}
          href={href}
          onClick={() => setClicked({ view: key, from: pathname })}
          aria-current={key === active ? "page" : undefined}
          className={cn(
            buttonGroupItemClass(false),
            "relative",
            key === active && "text-[color:var(--bjork-text)] hover:bg-transparent",
          )}
        >
          <Icon aria-hidden /> {label}
        </Link>
      ))}
    </ButtonGroup>
  );
}
