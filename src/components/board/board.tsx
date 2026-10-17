"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CalendarClock } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition, type RefObject } from "react";
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
};

export function Board({ stages, initialApplications }: { stages: Stage[]; initialApplications: Card[] }) {
  const [cards, setCards] = useState(initialApplications);
  const [, startTransition] = useTransition();
  // The click that ends a drag must not open the card link.
  const justDragged = useRef(false);
  const sensors = useSensors(
    // Small distance so a plain click still opens the card link.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  function onDragEnd({ active, over }: DragEndEvent) {
    setTimeout(() => (justDragged.current = false), 0);
    if (!over) return;
    const id = String(active.id);
    const toStage = String(over.id);
    const card = cards.find((c) => c.id === id);
    if (!card || card.currentStageId === toStage) return;

    const before = cards;
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, currentStageId: toStage } : c)));
    startTransition(async () => {
      const res: { ok: boolean; message?: string } = await moveApplication(id, toStage).catch(() => ({ ok: false }));
      if (!res.ok) {
        setCards(before);
        toast.error(res.message ?? "Gagal memindahkan lamaran. Coba lagi.");
      }
    });
  }

  return (
    <DndContext id="board" sensors={sensors} onDragStart={() => (justDragged.current = true)} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <Column key={stage.id} stage={stage} cards={cards.filter((c) => c.currentStageId === stage.id)} justDragged={justDragged} />
        ))}
      </div>
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
        "flex w-64 shrink-0 flex-col gap-2 rounded-xl bg-muted/50 p-2 transition-colors",
        isOver && "bg-muted ring-2 ring-ring/40",
      )}
    >
      <h2 className="flex items-center justify-between px-1 text-sm font-medium">
        {stage.name}
        <span className="text-xs text-muted-foreground">{cards.length}</span>
      </h2>
      {cards.map((card) => (
        <ApplicationCard key={card.id} card={card} justDragged={justDragged} />
      ))}
      <Link
        href={`/applications/new?stage=${stage.id}`}
        className="rounded-md px-1 py-1 text-xs text-muted-foreground hover:bg-background hover:text-foreground"
      >
        + Tambah
      </Link>
    </section>
  );
}

function ApplicationCard({ card, justDragged }: { card: Card; justDragged: RefObject<boolean> }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id });
  const days = card.deadline ? daysUntil(card.deadline) : null;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClickCapture={(e) => {
        if (justDragged.current) e.preventDefault();
      }}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={cn(
        "touch-none rounded-lg border bg-card p-3 text-sm shadow-xs",
        isDragging && "relative z-10 opacity-80 shadow-lg",
      )}
    >
      <Link href={`/applications/${card.id}`} className="block space-y-1" draggable={false}>
        <p className="font-medium">{card.company}</p>
        <p className="text-muted-foreground">{card.position}</p>
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <Badge variant="secondary">{JOB_SOURCE_LABELS[card.source]}</Badge>
          {card.eligibility && <EligibilityBadge status={card.eligibility} />}
          {card.deadline && days !== null && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs",
                days <= 3 ? "font-medium text-destructive" : "text-muted-foreground",
              )}
              title={days < 0 ? "Deadline sudah lewat" : `${days} hari lagi`}
            >
              <CalendarClock className="size-3" />
              {formatDate(card.deadline)}
            </span>
          )}
        </div>
      </Link>
    </div>
  );
}
