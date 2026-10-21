"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import ButtonGroup, { buttonGroupItemClass } from "@/components/ui/primitive-button-group";
import { cn } from "@/lib/utils";

/** `short`: label on phones, so a row of tabs fits without scrolling. */
type Item = { href: string; label: string; short?: string; icon?: LucideIcon; badge?: number };
type Box = { left: number; width: number };

/**
 * iOS-style segmented navigation: a raised pill slides to the chosen segment, and can be dragged with a finger
 * (or mouse) from the chosen segment to another. Taps still go through the links, so keyboard and screen
 * readers get plain links. The pill is measured from the segments, so they can differ in width. If they don't fit,
 * the tray scrolls sideways natively and dragging is off: a press on the pill must not fight the scroll (on iOS it
 * blocked scrolling altogether).
 * A choice moves the pill right away; `active` takes over again whenever it changes (navigation landed, or the
 * back button), so a stale choice never sticks.
 */
export function SegmentedNav({
  items,
  active,
  label,
  fill,
  scroll,
  className,
  itemClassName,
}: {
  items: Item[];
  active: number;
  label: string;
  /** Segments share the full width equally. */
  fill?: boolean;
  /** Passed to the links (false keeps the scroll position, e.g. for tabs). */
  scroll?: boolean;
  className?: string;
  itemClassName?: string;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<number | null>(null);
  const [lastActive, setLastActive] = useState(active);
  if (active !== lastActive) {
    setLastActive(active);
    setPicked(null);
  }
  const current = picked ?? active;

  const tray = useRef<HTMLDivElement>(null);
  const links = useRef<(HTMLAnchorElement | null)[]>([]);
  const [box, setBox] = useState<Box | null>(null); // null until measured: the chosen link draws itself raised
  const [dragLeft, setDragLeft] = useState<number | null>(null);
  const [overflow, setOverflow] = useState(false);
  const press = useRef<{ x: number; left: number; dragging: boolean } | null>(null);
  const swallowClick = useRef(false);

  const boxOf = (i: number): Box => {
    const el = links.current[i]!;
    return { left: el.offsetLeft, width: el.offsetWidth };
  };
  useLayoutEffect(() => {
    const measure = () => {
      const el = links.current[current]!;
      setBox({ left: el.offsetLeft, width: el.offsetWidth });
      setOverflow(tray.current!.scrollWidth > tray.current!.clientWidth + 1);
    };
    measure();
    // Bring the chosen segment into view when the tray scrolls (e.g. opened straight on the last tab).
    const t = tray.current!;
    const el = links.current[current]!;
    if (el.offsetLeft < t.scrollLeft) t.scrollLeft = el.offsetLeft - 4;
    else if (el.offsetLeft + el.offsetWidth > t.scrollLeft + t.clientWidth)
      t.scrollLeft = el.offsetLeft + el.offsetWidth - t.clientWidth + 4;
    const ro = new ResizeObserver(measure);
    ro.observe(tray.current!);
    return () => ro.disconnect();
  }, [current]);

  // While dragging, the segment under the pill's centre is the one it will land on.
  const nearest = (centre: number) => {
    const dist = (i: number) => Math.abs(boxOf(i).left + boxOf(i).width / 2 - centre);
    return items.reduce((best, _, i) => (dist(i) < dist(best) ? i : best), 0);
  };
  const shown = dragLeft !== null && box ? nearest(dragLeft + box.width / 2) : current;

  const choose = (index: number) => {
    setPicked(index);
    if (index !== current) router.push(items[index].href, { scroll: scroll ?? true });
  };

  return (
    <ButtonGroup
      ref={tray}
      role="navigation"
      aria-label={label}
      className={cn("relative inline-flex p-1 select-none", className)}
      onPointerDown={(e) => {
        swallowClick.current = false;
        if (!box || overflow || !links.current[current]?.contains(e.target as Node)) return;
        press.current = { x: e.clientX, left: box.left, dragging: false };
      }}
      onPointerMove={(e) => {
        const p = press.current;
        if (!p || !box) return;
        const dx = e.clientX - p.x;
        if (!p.dragging && Math.abs(dx) < 6) return;
        if (!p.dragging) {
          p.dragging = true;
          e.currentTarget.setPointerCapture(e.pointerId);
        }
        const first = boxOf(0);
        const last = boxOf(items.length - 1);
        setDragLeft(Math.min(Math.max(p.left + dx, first.left), last.left + last.width - box.width));
      }}
      onPointerUp={() => {
        const p = press.current;
        press.current = null;
        if (!p?.dragging) return;
        // The release can click the link under the finger; ignore that one (reset on the next press).
        swallowClick.current = true;
        setDragLeft(null);
        choose(shown);
      }}
      onPointerCancel={() => {
        press.current = null;
        setDragLeft(null);
      }}
    >
      {box && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-1 left-0 bg-[var(--bjork-field)] shadow-[var(--bjork-shadow-raised)] motion-reduce:transition-none",
            dragLeft === null ? "transition-[transform,width] duration-300 ease-out" : "scale-[0.97]",
          )}
          style={{ width: box.width, transform: `translateX(${dragLeft ?? box.left}px)` }}
        />
      )}
      {items.map(({ href, label, short, icon: Icon, badge }, i) => (
        <Link
          key={href}
          ref={(el) => {
            links.current[i] = el;
          }}
          href={href}
          scroll={scroll}
          draggable={false}
          onClick={(e) => {
            if (swallowClick.current) {
              swallowClick.current = false;
              e.preventDefault();
              return;
            }
            setPicked(i);
          }}
          aria-current={i === current ? "page" : undefined}
          className={cn(
            buttonGroupItemClass(!box && i === current),
            "relative shrink-0",
            fill && "flex-1",
            i === current && !overflow && "touch-pan-y", // a sideways press here drags the pill
            box && i === shown && "text-[color:var(--bjork-text)] hover:bg-transparent",
            itemClassName,
          )}
        >
          {Icon && <Icon aria-hidden />}{" "}
          {short ? (
            <>
              <span className="sm:hidden">{short}</span>
              <span className="hidden sm:inline">{label}</span>
            </>
          ) : (
            label
          )}
          {!!badge && (
            <span className="bg-primary/15 text-primary rounded-full px-1 text-[11px] tabular-nums sm:px-1.5">
              {badge}
            </span>
          )}
        </Link>
      ))}
    </ButtonGroup>
  );
}
