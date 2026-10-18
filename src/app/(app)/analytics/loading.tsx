import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="max-w-4xl space-y-8" role="status" aria-label="Memuat analytics">
      <Skeleton className="h-7 w-40" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="space-y-2">
        {[100, 80, 62, 48, 40, 32, 18, 10].map((w, i) => (
          <div key={i} className="grid grid-cols-[minmax(6rem,9rem)_1fr] items-center gap-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5" style={{ width: `${w}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}
