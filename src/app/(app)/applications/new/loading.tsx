import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-label="Memuat formulir">
      <Skeleton className="h-8 w-44" />
      <div className="grid gap-4 sm:grid-cols-2 lg:max-w-3xl">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-10 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
