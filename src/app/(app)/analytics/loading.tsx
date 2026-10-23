import { SkeletonBars, SkeletonCard, SkeletonStat } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="max-w-7xl space-y-5" role="status" aria-label="Memuat analytics">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground text-sm">
            Strategi mana yang paling berhasil: sumber, versi CV, dan tahap.
          </p>
        </div>
        <Skeleton className="h-11 w-56 rounded-[18px]" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <SkeletonStat key={i} />
        ))}
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <SkeletonCard className="lg:col-span-2">
          <SkeletonBars widths={[100, 77, 62, 46, 38, 31, 15, 8]} />
        </SkeletonCard>
        <SkeletonCard>
          <SkeletonBars widths={[90, 90, 90, 90]} />
        </SkeletonCard>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <SkeletonCard key={i}>
            <div className="-mx-5 -mb-5 divide-y border-t">
              {Array.from({ length: 4 }, (_, j) => (
                <div key={j} className="grid grid-cols-[1fr_3rem_1fr_1fr] items-center gap-3 px-5 py-3.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-6" />
                  <Skeleton className="h-2.5 w-20 rounded-full" />
                  <Skeleton className="h-2.5 w-20 rounded-full" />
                </div>
              ))}
            </div>
          </SkeletonCard>
        ))}
      </div>
    </div>
  );
}
