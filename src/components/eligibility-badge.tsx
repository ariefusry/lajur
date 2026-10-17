import { CircleAlert, CircleCheck, CircleHelp, CircleX } from "lucide-react";
import type { EligibilityStatus } from "@/generated/prisma/enums";
import { ELIGIBILITY_LABELS } from "@/lib/eligibility/check";
import { cn } from "@/lib/utils";

const STYLE: Record<EligibilityStatus, { className: string; Icon: typeof CircleCheck }> = {
  MEETS: { className: "bg-green-600/10 text-green-700 dark:text-green-400", Icon: CircleCheck },
  WARNING: { className: "bg-amber-500/15 text-amber-700 dark:text-amber-400", Icon: CircleAlert },
  FAILS: { className: "bg-destructive/10 text-destructive", Icon: CircleX },
  UNKNOWN: { className: "bg-muted text-muted-foreground", Icon: CircleHelp },
};

export function EligibilityBadge({ status, title }: { status: EligibilityStatus; title?: string }) {
  const { className, Icon } = STYLE[status];
  return (
    <span
      title={title}
      className={cn("inline-flex h-5 items-center gap-1 rounded-4xl px-2 text-xs font-medium whitespace-nowrap", className)}
    >
      <Icon className="size-3" aria-hidden /> {ELIGIBILITY_LABELS[status]}
    </span>
  );
}
