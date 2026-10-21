import { cva } from "class-variance-authority";
import { Check, Clock, X } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

// Vertical timeline (adapted from preetsuthar17's timeline: vertical only, no examples, dates formatted by
// the caller so they stay in Indonesian and WIB).

export type TimelineStatus = "default" | "completed" | "active" | "pending" | "error";

export interface TimelineItem {
  id: string;
  title: React.ReactNode;
  /** Already formatted, e.g. formatDate() from lib/dates. */
  timestamp?: string;
  description?: React.ReactNode;
  status?: TimelineStatus;
  icon?: React.ReactNode;
  content?: React.ReactNode;
}

// From just under this icon to just above the next one (the li gap is 1rem).
const connectorVariants = cva("absolute top-7 left-3 h-[calc(100%-1rem)] w-px", {
  variants: {
    status: {
      default: "bg-border",
      completed: "bg-primary",
      active: "bg-primary",
      pending: "bg-muted-foreground/30",
      error: "bg-destructive",
    },
  },
  defaultVariants: { status: "default" },
});

const iconVariants = cva(
  "bg-background flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-medium",
  {
    variants: {
      status: {
        default: "border-border text-muted-foreground",
        completed: "border-primary bg-primary text-primary-foreground",
        active: "border-primary text-primary motion-safe:animate-pulse",
        pending: "border-muted-foreground/30 text-muted-foreground",
        error: "border-destructive bg-destructive text-white",
      },
    },
    defaultVariants: { status: "default" },
  },
);

function statusIcon(status: TimelineStatus = "default") {
  if (status === "completed") return <Check className="size-3" />;
  if (status === "active" || status === "pending") return <Clock className="size-3" />;
  if (status === "error") return <X className="size-3" />;
  return <span className="size-2 rounded-full bg-current" />;
}

export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cn("relative flex flex-col gap-4", className)}>
      {items.map((item, i) => (
        <li key={item.id} className="relative flex gap-3 pb-2">
          {i < items.length - 1 && <span aria-hidden className={connectorVariants({ status: item.status })} />}
          <span aria-hidden className={cn("relative z-10", iconVariants({ status: item.status }))}>
            {item.icon ?? statusIcon(item.status)}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h3 className="leading-tight font-medium">{item.title}</h3>
              {item.timestamp && <time className="text-muted-foreground text-xs">{item.timestamp}</time>}
            </div>
            {item.description && (
              <div className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">
                {item.description}
              </div>
            )}
            {item.content}
          </div>
        </li>
      ))}
    </ol>
  );
}
