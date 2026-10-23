import { SkeletonCard } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="max-w-7xl space-y-5" role="status" aria-label="Memuat lamaran">
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-5 w-40" />
        </div>
        {/* Stage progress */}
        <div className="flex flex-wrap gap-2">
          {[16, 24, 24, 18, 12, 22, 24, 12, 18].map((w, i) => (
            <Skeleton key={i} className="h-7 rounded-lg" style={{ width: `${w * 4}px` }} />
          ))}
        </div>
      </div>
      {/* Tabs */}
      <Skeleton className="h-12 w-full max-w-[30rem] rounded-[18px]" />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <SkeletonCard>
            <Skeleton className="h-4 w-72 max-w-full" />
          </SkeletonCard>
          <SkeletonCard>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </SkeletonCard>
        </div>
        <div className="space-y-4">
          <SkeletonCard>
            <div className="flex gap-2">
              <Skeleton className="h-10 flex-1 rounded-lg" />
              <Skeleton className="h-10 flex-1 rounded-lg" />
            </div>
            <Skeleton className="h-10 rounded-lg" />
          </SkeletonCard>
          <SkeletonCard>
            <div className="space-y-3">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="grid grid-cols-[7rem_1fr] gap-3">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-28" />
                </div>
              ))}
            </div>
          </SkeletonCard>
        </div>
      </div>
    </div>
  );
}
