import { SkeletonBars, SkeletonCard, SkeletonRows, SkeletonStat } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="max-w-7xl space-y-5" role="status" aria-label="Memuat dashboard">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28 rounded-lg" />
          <Skeleton className="h-10 w-44 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonStat key={i} />
        ))}
      </div>
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <SkeletonCard>
            <SkeletonRows count={3} />
          </SkeletonCard>
          <SkeletonCard>
            <SkeletonBars widths={[50, 25, 25, 25, 25, 25]} />
          </SkeletonCard>
        </div>
        <div className="flex flex-col gap-4">
          <SkeletonCard>
            <SkeletonRows count={3} />
          </SkeletonCard>
          <SkeletonCard>
            <div className="flex h-24 items-end gap-2">
              {[10, 10, 10, 10, 10, 70, 70, 35, 70, 100, 35, 70].map((h, i) => (
                <Skeleton key={i} className="flex-1 rounded-sm" style={{ height: `${h}%` }} />
              ))}
            </div>
          </SkeletonCard>
        </div>
      </div>
    </div>
  );
}
