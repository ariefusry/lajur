import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** One dashboard tile: title, short description, optional header action, then content. */
export function Card({
  title,
  description,
  action,
  className,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("glass flex flex-col gap-4 overflow-hidden rounded-2xl border p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold tracking-tight">{title}</h2>
          {description && <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** KPI tile: label, big value, and the count behind it ("3 dari 40"). */
export function Stat({ label, value, note, href }: { label: string; value: number | string; note?: string; href?: string }) {
  const className = cn("glass rounded-2xl border p-4", href && "transition-[box-shadow,transform] hover:shadow-md active:scale-[0.98]");
  const body = (
    <>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {note && <p className="text-muted-foreground text-xs">{note}</p>}
    </>
  );
  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export const pct = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)}%`);
