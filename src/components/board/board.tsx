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
import { ArrowRightLeft, CalendarClock } from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type RefObject,
} from "react";
import { toast } from "sonner";
import { moveApplication } from "@/actions/applications";
import { EligibilityBadge } from "@/components/eligibility-badge";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import type { EligibilityStatus, EventType, JobSource, StageKind } from "@/generated/prisma/enums";
import { daysUntil, formatDate, formatEventWhenShort } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { EVENT_TYPE_LABELS, JOB_SOURCE_LABELS } from "@/lib/validation";

type Stage = { id: string; name: string; kind: StageKind };
type Card = {
  id: string;
  company: string;
  position: string;
  source: JobSource;
  deadline: Date | null;
  currentStageId: string;
  eligibility: EligibilityStatus | null;
  /** Soonest test/interview/etc. that hasn't happened yet. */
  nextEvent: { type: EventType; startsAt: Date; opensAt: Date | null } | null;
  /** No news for 30+ days while in a selection stage (derived on the server). */
  ghosted: boolean;
};

// Cards are narrow: long source names get a short form.
const SHORT_SOURCE: Partial<Record<JobSource, string>> = {
  BUMN_PORTAL: "Portal BUMN",
  COMPANY_SITE: "Situs perusahaan",
};

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

  /**
   * Optimistic move, shared by drag and the "Pindah ke" menu. `restore` is set when undoing: the card goes back
   * exactly as it was. Moving back is safe server-side: moveApplication drops the history step it just added.
   */
  function move(card: Card, toStage: string, restore?: Card) {
    if (card.currentStageId === toStage) return;
    // A move is news, so the card is no longer ghosted.
    const moved = restore ?? { ...card, currentStageId: toStage, ghosted: false };
    const put = (next: Card) => setCards((cs) => cs.map((c) => (c.id === card.id ? next : c)));
    put(moved);
    startTransition(async () => {
      const res: { ok: boolean; message?: string } = await moveApplication(card.id, toStage).catch(() => ({
        ok: false,
      }));
      if (!res.ok) {
        put(card);
        toast.error(res.message ?? "Gagal memindahkan lamaran. Coba lagi.");
        return;
      }
      if (restore) return;
      toast(`Dipindah ke ${stages.find((s) => s.id === toStage)?.name}`, {
        description: card.company,
        action: { label: "Urungkan", onClick: () => move(moved, card.currentStageId, card) },
      });
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    setTimeout(() => (justDragged.current = false), 0);
    const card = cards.find((c) => c.id === String(active.id));
    if (over && card) move(card, String(over.id));
  }

  const activeCard = activeId ? cards.find((c) => c.id === activeId) : undefined;

  const scroller = useRef<HTMLDivElement>(null);

  // Trello-style: the board is exactly one screen tall, so columns run to the bottom edge, the horizontal
  // scrollbar stays in view, and a long column scrolls inside itself instead of stretching the page.
  useLayoutEffect(() => {
    const el = scroller.current;
    const main = el?.closest("main");
    if (!el || !main) return;
    const fit = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      const pad = parseFloat(getComputedStyle(main).paddingBottom);
      // Phones: down to just above the tab bar. main's tall bottom padding (room for the floating + button on
      // pages that scroll) isn't needed here, so the margin takes it back.
      const bar = document.querySelector("[data-tab-bar]")?.getBoundingClientRect();
      const below = bar?.height ? window.innerHeight - bar.top + 12 : pad;
      el.style.marginBottom = `${below - pad}px`;
      // 320px floor: on a short landscape phone the page scrolls instead of the board shrinking to a sliver.
      el.style.height = `${Math.max(320, window.innerHeight - top - below)}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    // The page enter animation (app/(app)/template.tsx) shifts the board while it runs; measure again after.
    window.addEventListener("animationend", fit);
    const ro = new ResizeObserver(fit); // the header above can wrap (demo banner, narrow screens)
    ro.observe(main);
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("animationend", fit);
      ro.disconnect();
    };
  }, []);
  // Fade the right edge while more columns are scrolled out of view.
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
          <Column
            key={stage.id}
            stage={stage}
            stages={stages}
            cards={cards.filter((c) => c.currentStageId === stage.id)}
            justDragged={justDragged}
            onMove={move}
          />
        ))}
      </div>
      {/* The lifted copy follows the pointer above everything (never clipped by the scroll area),
          then glides into the card's new slot on drop. */}
      <DragOverlay dropAnimation={reducedMotion ? null : { duration: 220, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }}>
        {activeCard && (
          <div className="glass scale-[1.03] rotate-1 cursor-grabbing rounded-xl border p-3 text-sm shadow-xl motion-reduce:scale-100 motion-reduce:rotate-0">
            <CardBody card={activeCard} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

type MoveProps = { stages: Stage[]; justDragged: RefObject<boolean>; onMove: (card: Card, toStage: string) => void };

function Column({ stage, cards, ...props }: MoveProps & { stage: Stage; cards: Card[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <section
      ref={setNodeRef}
      aria-label={stage.name}
      className={cn(
        "bg-foreground/[0.04] flex w-[min(17rem,82vw)] shrink-0 snap-start flex-col gap-2.5 rounded-2xl p-2.5 transition-colors",
        isOver && "bg-primary/10 ring-primary/30 ring-2",
      )}
    >
      <h2 className="flex items-center justify-between px-1.5 pt-0.5 text-sm font-semibold">
        {stage.name}
        <span className="bg-foreground/8 text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium tabular-nums">
          {cards.length}
        </span>
      </h2>
      {/* Only the cards scroll; the title stays put. -mx/px keeps card shadows from being clipped. */}
      {/* pb-16 on phones: the last card can scroll clear of the floating + button. */}
      <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-y-contain px-1 pt-0.5 pb-16 md:pb-0.5">
        {cards.map((card) => (
          <ApplicationCard key={card.id} card={card} {...props} />
        ))}
        {cards.length === 0 && <p className="text-muted-foreground px-1.5 text-xs">Belum ada lamaran</p>}
      </div>
    </section>
  );
}

function ApplicationCard({ card, stages, justDragged, onMove }: MoveProps & { card: Card }) {
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
        "glass group relative cursor-grab rounded-xl border p-3.5 text-sm transition-shadow select-none [-webkit-touch-callout:none] hover:shadow-md",
        // The original stays in place as a faint placeholder while its lifted copy moves.
        isDragging && "opacity-40 shadow-none",
      )}
    >
      <Link href={`/applications/${card.id}`} className="block pr-7" draggable={false}>
        <CardBody card={card} />
      </Link>
      {/* Two taps instead of a long drag across columns (mostly for phones). */}
      <div
        className="absolute top-2 right-2"
        // Keep presses here (and in the portalled list, whose events bubble through React) from starting a drag.
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <Select
          aria-label="Pindah ke tahap"
          value={card.currentStageId}
          onValueChange={(stageId) => onMove(card, stageId)}
          options={stages.map((s) => ({ value: s.id, label: s.name }))}
          trigger={
            <button
              type="button"
              className="text-muted-foreground hover:bg-foreground/5 hover:text-foreground focus-visible:ring-ring/50 data-[state=open]:bg-foreground/5 flex size-7 cursor-pointer items-center justify-center rounded-md transition-opacity outline-none focus-visible:ring-2 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100 pointer-fine:data-[state=open]:opacity-100"
            >
              <ArrowRightLeft className="size-4" />
            </button>
          }
        />
      </div>
    </div>
  );
}

function CardBody({ card }: { card: Card }) {
  // Once a test or interview is scheduled, it matters more than the application deadline.
  const due = card.nextEvent
    ? {
        at: card.nextEvent.startsAt,
        text: `${EVENT_TYPE_LABELS[card.nextEvent.type]} · ${formatEventWhenShort(card.nextEvent)}`,
      }
    : card.deadline && { at: card.deadline, text: formatDate(card.deadline) };
  const days = due ? daysUntil(due.at) : null;
  return (
    <div className="space-y-1">
      <p className="leading-snug font-semibold">{card.company}</p>
      <p className="text-muted-foreground">{card.position}</p>
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <Badge variant="secondary">{SHORT_SOURCE[card.source] ?? JOB_SOURCE_LABELS[card.source]}</Badge>
        {card.eligibility && <EligibilityBadge status={card.eligibility} />}
        {card.ghosted && (
          <Badge
            variant="secondary"
            className="bg-amber-500/15 text-amber-700 dark:text-amber-300"
            title="Tanpa kabar 30 hari atau lebih"
          >
            Ghosted
          </Badge>
        )}
        {due && days !== null && (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs",
              days <= 3 ? "text-destructive font-medium" : "text-muted-foreground",
            )}
            title={days < 0 ? "Deadline sudah lewat" : `${days} hari lagi`}
          >
            <CalendarClock className="size-3" />
            {due.text}
          </span>
        )}
      </div>
    </div>
  );
}
