import { KanbanSquare, List } from "lucide-react";
import Link from "next/link";
import ButtonGroup, { buttonGroupItemClass } from "@/components/ui/primitive-button-group";

const VIEWS = [
  { key: "board", href: "/board", label: "Board", icon: KanbanSquare },
  { key: "list", href: "/applications", label: "Daftar", icon: List },
] as const;

/** Segmented control between the kanban board and the full list of applications. */
export function ViewSwitch({ active }: { active: "board" | "list" }) {
  return (
    <ButtonGroup role="navigation" aria-label="Tampilan lamaran" className="p-1">
      {VIEWS.map(({ key, href, label, icon: Icon }) => (
        <Link
          key={key}
          href={href}
          aria-current={key === active ? "page" : undefined}
          className={buttonGroupItemClass(key === active)}
        >
          <Icon aria-hidden /> {label}
        </Link>
      ))}
    </ButtonGroup>
  );
}
