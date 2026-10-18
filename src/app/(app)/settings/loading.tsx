import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="grid max-w-6xl items-start gap-10 xl:grid-cols-2" role="status" aria-label="Memuat pengaturan">
      <div className="space-y-4">
        <Skeleton className="h-8 w-28" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-10 rounded-lg" />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-10 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
