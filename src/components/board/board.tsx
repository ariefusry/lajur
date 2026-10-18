"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CalendarClock } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition, type RefObject } from "react";
import { toast } from "sonner";
import { moveApplication } from "@/actions/applications";
import { EligibilityBadge } from "@/components/eligibility-badge";
import { Badge } from "@/components/ui/badge";
import type { EligibilityStatus, JobSource, StageKind } from "@/generated/prisma/enums";
import { daysUntil, formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { JOB_SOURCE_LABELS } from "@/lib/validation";

type Stage = { id: string; name: string; kind: StageKind };
type Card = {
  id: string;
  company: string;
  position: string;
  source: JobSource;
  deadline: Date | null;
  currentStageId: string;
  eligibility: EligibilityStatus | null;
  /** No news for 30+ days while in a selection stage (derived on the server). */
  ghosted: boolean;
};

// Cards are narrow: long source names get a short form.
const SHORT_SOURCE: Partial<Record<JobSource, string>> = { BUMN_PORTAL: "Portal BUMN", COMPANY_SITE: "Situs perusahaan" };

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(reducedMotionQuery);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(reducedMotionQuery).matches,
    () => false,
  );
}

export function Board({ stages, initialApplications }: { stages: Stage[]; initialApplications: Card[] }) {
  const [cards, setCards] = useState(initialApplications);
  // Adopt fresh server data (after a refresh, undo or revalidation) instead of keeping the first render's list.
  const [seen, setSeen] = useState(initialApplications);
  if (initialApplications !== seen) {
    setSeen(initialApplications);
    setCards(initialApplications);
  }
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const reducedMotion = usePrefersReducedMotion();
  // The click that ends a drag must not open the card link.
  const justDragged = useRef(false);
  const sensors = useSensors(
    // Mouse: a small distance so a plain click still opens the card.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Touch: press-and-hold, so a normal swipe keeps scrolling the board.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  function onDragStart({ active }: DragStartEvent) {
    justDragged.current = true;
    setActiveId(String(active.id));
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    setTimeout(() => (justDragged.current = false), 0);
    if (!over) return;
    const id = String(active.id);
    const toStage = String(over.id);
    const card = cards.find((c) => c.id === id);
    if (!card || card.currentStageId === toStage) return;

    const before = cards;
    // A move is news, so the card is no longer ghosted.
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, currentStageId: toStage, ghosted: false } : c)));
    startTransition(async () => {
      const res: { ok: boolean; message?: string } = await moveApplication(id, toStage).catch(() => ({ ok: false }));
      if (!res.ok) {
        setCards(before);
        toast.error(res.message ?? "Gagal memindahkan lamaran. Coba lagi.");
      }
    });
  }

  const activeCard = activeId ? cards.find((c) => c.id === activeId) : undefined;

  // Fade the right edge while more columns are scrolled out of view.
  const scroller = useRef<HTMLDivElement>(null);
  const [moreRight, setMoreRight] = useState(false);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const update = () => setMoreRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  return (
    <DndContext
      id="board"
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setTimeout(() => (justDragged.current = false), 0);
      }}
    >
      <div
        ref={scroller}
        className="-mx-4 -mt-1 flex snap-x gap-3 overflow-x-auto px-4 pt-1 pb-4 md:-mx-1 md:snap-none md:px-1"
        style={moreRight ? { maskImage: "linear-gradient(to right, #000 calc(100% - 3rem), transparent)" } : undefined}
      >
        {stages.map((stage) => (
          <Column key={stage.id} stage={stage} cards={cards.filter((c) => c.currentStageId === stage.id)} justDragged={justDragged} />
        ))}
      </div>
      {/* The lifted copy follows the pointer above everything (never clipped by the scroll area),
          then glides into the card's new slot on drop. */}
      <DragOverlay dropAnimation={reducedMotion ? null : { duration: 220, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }}>
        {activeCard && (
          <div className="scale-[1.03] rotate-1 cursor-grabbing glass rounded-xl border p-3 text-sm shadow-xl motion-reduce:scale-100 motion-reduce:rotate-0">
            <CardBody card={activeCard} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function Column({ stage, cards, justDragged }: { stage: Stage; cards: Card[]; justDragged: RefObject<boolean> }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <section
      ref={setNodeRef}
      aria-label={stage.name}
      className={cn(
        "flex w-[min(17rem,82vw)] shrink-0 snap-start flex-col gap-2.5 rounded-2xl bg-foreground/[0.04] p-2.5 transition-colors",
        isOver && "bg-primary/10 ring-2 ring-primary/30",
      )}
    >
      <h2 className="flex items-center justify-between px-1.5 pt-0.5 text-sm font-semibold">
        {stage.name}
        <span className="rounded-full bg-foreground/8 px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">{cards.length}</span>
      </h2>
      {cards.map((card) => (
        <ApplicationCard key={card.id} card={card} justDragged={justDragged} />
      ))}
      {cards.length === 0 && (
        <p className="text-muted-foreground rounded-xl border border-dashed px-3 py-6 text-center text-sm">
          Belum ada lamaran. Tarik kartu ke sini.
        </p>
      )}
      <Link
        href={`/applications/new?stage=${stage.id}`}
        className="rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
      >
        + Tambah
      </Link>
    </section>
  );
}

function ApplicationCard({ card, justDragged }: { card: Card; justDragged: RefObject<boolean> }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClickCapture={(e) => {
        if (justDragged.current) e.preventDefault();
      }}
      className={cn(
        "glass cursor-grab rounded-xl border p-3.5 text-sm transition-shadow select-none [-webkit-touch-callout:none] hover:shadow-md",
        // The original stays in place as a faint placeholder while its lifted copy moves.
        isDragging && "opacity-40 shadow-none",
      )}
    >
      <Link href={`/applications/${card.id}`} className="block" draggable={false}>
        <CardBody card={card} />
      </Link>
    </div>
  );
}

function CardBody({ card }: { card: Card }) {
  const days = card.deadline ? daysUntil(card.deadline) : null;
  return (
    <div className="space-y-1">
      <p className="leading-snug font-semibold">{card.company}</p>
      <p className="text-muted-foreground">{card.position}</p>
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <Badge variant="secondary">{SHORT_SOURCE[card.source] ?? JOB_SOURCE_LABELS[card.source]}</Badge>
        {card.eligibility && <EligibilityBadge status={card.eligibility} />}
        {card.ghosted && (
          <Badge variant="secondary" className="bg-amber-500/15 text-amber-700 dark:text-amber-300" title="Tanpa kabar 30 hari atau lebih">
            Ghosted
          </Badge>
        )}
        {card.deadline && days !== null && (
          <span
            className={cn("inline-flex items-center gap-1 text-xs", days <= 3 ? "font-medium text-destructive" : "text-muted-foreground")}
            title={days < 0 ? "Deadline sudah lewat" : `${days} hari lagi`}
          >
            <CalendarClock className="size-3" />
            {formatDate(card.deadline)}
          </span>
        )}
      </div>
    </div>
  );
}
