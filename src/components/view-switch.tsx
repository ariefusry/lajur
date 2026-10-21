"use client";

import { KanbanSquare, List } from "lucide-react";
import { usePathname } from "next/navigation";
import { SegmentedNav } from "@/components/ui/segmented-nav";

const VIEWS = [
  { href: "/board", label: "Board", icon: KanbanSquare },
  { href: "/applications", label: "Daftar", icon: List },
];

/**
 * Segmented control between the kanban board and the full list. It lives in the shared layout, so it stays
 * mounted across the switch and the pill slides instead of jumping.
 */
export function ViewSwitch() {
  const pathname = usePathname();
  return (
    <SegmentedNav
      items={VIEWS}
      active={pathname.startsWith("/board") ? 0 : 1}
      label="Tampilan lamaran"
      className="inline-flex"
    />
  );
}
