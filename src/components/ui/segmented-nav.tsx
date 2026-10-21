"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import ButtonGroup, { buttonGroupItemClass } from "@/components/ui/primitive-button-group";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; icon?: LucideIcon };

const GAP_REM = 0.25; // gap-1 between segments, and the tray's p-1

/**
 * iOS-style segmented navigation: a raised pill slides to the chosen segment, and can be dragged with a finger
 * (or mouse) from the chosen segment to another. Taps still go through the links, so keyboard and screen
 * readers get plain links. A choice moves the pill right away; the pathname takes over once navigation lands.
 */
export function SegmentedNav({
  items,
  active,
  label,
  className,
}: {
  items: Item[];
  active: number;
  label: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [picked, setPicked] = useState<{ index: number; from: string } | null>(null);
  const current = picked?.from === pathname ? picked.index : active;
  const [dragX, setDragX] = useState<number | null>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const press = useRef<{ x: number; dragging: boolean } | null>(null);
  const swallowClick = useRef(false);
  const n = items.length;

  // One step = pill width + gap, in px (the pill's width is a share of the tray).
  const step = () => {
    const el = pill.current!;
    return el.offsetWidth + parseFloat(getComputedStyle(el).fontSize) * GAP_REM;
  };
  const choose = (index: number) => {
    setPicked({ index, from: pathname });
    if (index !== current) router.push(items[index].href);
  };
  const shown = dragX === null ? current : Math.round(dragX / step());

  return (
    <ButtonGroup
      role="navigation"
      aria-label={label}
      className={cn("relative grid touch-pan-y p-1 select-none", className)}
      style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
      onPointerDown={(e) => {
        // Only a press on the chosen segment can drag the pill, like iOS; elsewhere it's a tap.
        const r = pill.current!.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right) return;
        press.current = { x: e.clientX, dragging: false };
      }}
      onPointerMove={(e) => {
        const p = press.current;
        if (!p) return;
        const dx = e.clientX - p.x;
        if (!p.dragging && Math.abs(dx) < 6) return;
        if (!p.dragging) {
          p.dragging = true;
          e.currentTarget.setPointerCapture(e.pointerId);
        }
        setDragX(Math.min(Math.max(current * step() + dx, 0), (n - 1) * step()));
      }}
      onPointerUp={() => {
        const p = press.current;
        press.current = null;
        if (!p?.dragging) return;
        swallowClick.current = true; // the release would otherwise click the link under the finger
        setDragX(null);
        choose(shown);
      }}
      onPointerCancel={() => {
        press.current = null;
        setDragX(null);
      }}
    >
      <span
        ref={pill}
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-1 left-1 bg-[var(--bjork-field)] shadow-[var(--bjork-shadow-raised)] motion-reduce:transition-none",
          dragX === null ? "transition-transform duration-300 ease-out" : "scale-[0.97]",
        )}
        style={{
          width: `calc((100% - ${2 * GAP_REM}rem - ${(n - 1) * GAP_REM}rem) / ${n})`,
          transform:
            dragX === null ? `translateX(calc(${current} * (100% + ${GAP_REM}rem)))` : `translateX(${dragX}px)`,
        }}
      />
      {items.map(({ href, label, icon: Icon }, i) => (
        <Link
          key={href}
          href={href}
          draggable={false}
          onClick={(e) => {
            if (swallowClick.current) {
              swallowClick.current = false;
              e.preventDefault();
              return;
            }
            setPicked({ index: i, from: pathname });
          }}
          aria-current={i === current ? "page" : undefined}
          className={cn(
            buttonGroupItemClass(false),
            "relative",
            i === shown && "text-[color:var(--bjork-text)] hover:bg-transparent",
          )}
        >
          {Icon && <Icon aria-hidden />} {label}
        </Link>
      ))}
    </ButtonGroup>
  );
}
