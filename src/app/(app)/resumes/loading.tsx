import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="max-w-6xl space-y-8" role="status" aria-label="Memuat CV">
      <Skeleton className="h-8 w-36" />
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-2xl sm:h-20" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
