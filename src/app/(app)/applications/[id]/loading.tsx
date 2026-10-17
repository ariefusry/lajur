import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="max-w-3xl space-y-8" role="status" aria-label="Memuat lamaran">
      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Skeleton className="h-32 w-full rounded-xl" />
      <div className="space-y-4 border-l pl-6">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-5 w-56" />
        ))}
      </div>
    </div>
  );
}
