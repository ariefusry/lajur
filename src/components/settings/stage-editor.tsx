"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { GripVertical } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { reorderStages, updateStage } from "@/actions/settings";
import { Input } from "@/components/ui/input";
import type { StageKind } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { STAGE_KIND_LABELS } from "@/lib/validation";
import { Select } from "@/components/ui/select";
import { optionsFrom } from "@/lib/utils";

type StageRow = { id: string; name: string; kind: StageKind };

/** Name and kind save on their own (blur / change); the grip reorders by drag or keyboard (Space, arrows). */
export function StageEditor({ stages }: { stages: StageRow[] }) {
  const [items, setItems] = useState(stages);
  // Adopt the server's list when stages are added or replaced (adjusting state during render, no effect needed).
  const signature = stages.map((s) => s.id).join(",");
  const [seen, setSeen] = useState(signature);
  if (signature !== seen) {
    setSeen(signature);
    setItems(stages);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function save(id: string, input: { name?: string; kind?: string }, rollback: () => void) {
    const res = await updateStage(id, input).catch(() => ({ ok: false, message: "Gagal menyimpan. Coba lagi." }));
    if (res.ok) toast.success(res.message);
    else {
      rollback();
      toast.error(res.message);
    }
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const before = items;
    const next = arrayMove(
      items,
      items.findIndex((s) => s.id === active.id),
      items.findIndex((s) => s.id === over.id),
    );
    setItems(next);
    reorderStages(next.map((s) => s.id))
      .then((res) => {
        if (!res.ok) throw new Error(res.message);
        toast.success(res.message);
      })
      .catch((e: Error) => {
        setItems(before);
        toast.error(e.message || "Gagal mengurutkan. Coba lagi.");
      });
  }

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs">
        Perubahan tersimpan otomatis. Seret ikon di kiri untuk mengurutkan.
      </p>
      <DndContext id="stages" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <ol className="space-y-2">
            {items.map((stage, i) => (
              <Row
                key={stage.id}
                stage={stage}
                index={i}
                onName={(name) => {
                  const old = stage.name;
                  setItems((xs) => xs.map((x) => (x.id === stage.id ? { ...x, name } : x)));
                  void save(stage.id, { name }, () =>
                    setItems((xs) => xs.map((x) => (x.id === stage.id ? { ...x, name: old } : x))),
                  );
                }}
                onKind={(kind) => {
                  const old = stage.kind;
                  setItems((xs) => xs.map((x) => (x.id === stage.id ? { ...x, kind } : x)));
                  void save(stage.id, { kind }, () =>
                    setItems((xs) => xs.map((x) => (x.id === stage.id ? { ...x, kind: old } : x))),
                  );
                }}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function Row({
  stage,
  index,
  onName,
  onKind,
}: {
  stage: StageRow;
  index: number;
  onName: (name: string) => void;
  onKind: (kind: StageKind) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.id,
  });
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        transition,
      }}
      className={cn("flex items-center gap-2", isDragging && "relative z-10 opacity-90 drop-shadow-lg")}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Urutkan tahap ${stage.name}`}
        className="text-muted-foreground hover:bg-foreground/5 flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg active:cursor-grabbing pointer-coarse:size-11"
      >
        <GripVertical className="size-4" />
      </button>
      <Input
        defaultValue={stage.name}
        aria-label={`Nama tahap ${index + 1}`}
        maxLength={50}
        onBlur={(e) => {
          const name = e.target.value.trim();
          if (name && name !== stage.name) onName(name);
          else e.target.value = stage.name;
        }}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="min-w-0 flex-1"
      />
      <Select
        value={stage.kind}
        onValueChange={(v) => onKind(v as StageKind)}
        aria-label={`Jenis tahap ${stage.name}`}
        className="w-36 shrink-0 sm:w-40"
        options={optionsFrom(STAGE_KIND_LABELS)}
      />
    </li>
  );
}
