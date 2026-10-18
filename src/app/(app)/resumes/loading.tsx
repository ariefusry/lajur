import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="max-w-6xl space-y-8" role="status" aria-label="Memuat CV">
      <Skeleton className="h-8 w-36" />
      <div className="grid items-start gap-8 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="space-y-3">
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
        </div>
        <Skeleton className="h-36 rounded-2xl" />
      </div>
    </div>
  );
}
