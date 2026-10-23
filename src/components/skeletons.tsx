import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Building blocks for loading.tsx files: the same shells as the loaded page (Card, Stat), so only the data
// fades in and nothing around it moves.

/** Like dashboard/cards Card: title and description bars, then the body. */
export function SkeletonCard({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn("glass flex flex-col gap-4 overflow-hidden rounded-2xl border p-5", className)}>
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-56 max-w-full" />
      </div>
      {children}
    </div>
  );
}

/** Like dashboard/cards Stat: label, big value, note. */
export function SkeletonStat() {
  return (
    <div className="glass space-y-2 rounded-2xl border p-4">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-14" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

/** Rows of a card list: a title and a subtitle, with something small on the right. */
export function SkeletonRows({ count, className }: { count: number; className?: string }) {
  return (
    <div className={cn("-mx-5 -mb-5 divide-y border-t", className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3.5">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56 max-w-full" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Label + bar rows (pipeline, funnel). */
export function SkeletonBars({ widths }: { widths: number[] }) {
  return (
    <div className="space-y-3.5">
      {widths.map((w, i) => (
        <div key={i} className="grid grid-cols-[minmax(6rem,9rem)_1fr_1.5rem] items-center gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-2.5 rounded-full" style={{ width: `${w}%` }} />
          <Skeleton className="h-4 w-4" />
        </div>
      ))}
    </div>
  );
}

/** A labelled form field. */
export function SkeletonField({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-10 rounded-lg" />
    </div>
  );
}
