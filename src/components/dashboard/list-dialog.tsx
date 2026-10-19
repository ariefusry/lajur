"use client";

import { X } from "lucide-react";
import { Dialog } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** "Lihat semua (N)": the card shows a few rows, this opens every one of them. The rows come in as children. */
export function ListDialog({
  title,
  description,
  count,
  triggerClassName,
  children,
}: {
  title: string;
  description?: string;
  count: number;
  triggerClassName?: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger
        className={cn("text-primary hover:bg-primary/10 text-xs font-medium transition-colors", triggerClassName)}
      >
        Lihat semua ({count}) →
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" />
        <Dialog.Content className="bg-background fixed top-1/2 left-1/2 z-50 flex max-h-[85dvh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border shadow-xl outline-none">
          <div className="flex items-start justify-between gap-3 p-5">
            <div className="min-w-0">
              <Dialog.Title className="font-semibold tracking-tight">
                {title} <span className="text-muted-foreground font-normal tabular-nums">({count})</span>
              </Dialog.Title>
              <Dialog.Description className="text-muted-foreground mt-0.5 text-xs">{description}</Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Tutup"
              className="text-muted-foreground hover:bg-foreground/5 hover:text-foreground -mt-1 -mr-1 rounded-md p-1.5 transition-colors"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <ul className="divide-y overflow-y-auto border-t">{children}</ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
