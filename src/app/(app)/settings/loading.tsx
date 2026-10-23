import { SkeletonCard, SkeletonField } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="max-w-7xl space-y-5" role="status" aria-label="Memuat pengaturan">
      <h1 className="text-2xl font-semibold tracking-tight">Pengaturan</h1>
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
        <div className="flex flex-col gap-4">
          <SkeletonCard>
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 5 }, (_, i) => (
                <SkeletonField key={i} />
              ))}
            </div>
            <Skeleton className="h-9 w-28 rounded-lg" />
          </SkeletonCard>
          <SkeletonCard>
            <div className="space-y-2">
              {[100, 95, 100, 70].map((w, i) => (
                <Skeleton key={i} className="h-4" style={{ width: `${w}%` }} />
              ))}
            </div>
            <Skeleton className="h-9 w-28 rounded-lg" />
          </SkeletonCard>
          <SkeletonCard>
            <Skeleton className="h-10 rounded-lg" />
          </SkeletonCard>
        </div>
        <SkeletonCard>
          <Skeleton className="h-3 w-80 max-w-full" />
          <div className="space-y-2">
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="size-9 shrink-0 rounded-lg" />
                <Skeleton className="h-10 flex-1 rounded-lg" />
                <Skeleton className="h-10 w-40 rounded-lg" />
              </div>
            ))}
          </div>
        </SkeletonCard>
      </div>
    </div>
  );
}
