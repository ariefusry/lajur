import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="max-w-7xl space-y-4" role="status" aria-label="Memuat daftar lamaran">
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-10 basis-full rounded-lg sm:flex-1 sm:basis-auto" />
        <Skeleton className="h-10 w-44 rounded-lg" />
        <Skeleton className="h-10 w-44 rounded-lg" />
        <Skeleton className="h-10 w-24 rounded-lg" />
      </div>
      <Skeleton className="h-4 w-20" />
      <div className="glass divide-y overflow-hidden rounded-2xl border">
        <div className="hidden px-5 py-3 md:block">
          <Skeleton className="h-3 w-full max-w-2xl" />
        </div>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5">
            <div className="min-w-0 flex-1 space-y-2 md:max-w-[19rem]">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-56 max-w-full" />
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="hidden h-4 w-40 md:block" />
            <Skeleton className="ml-auto hidden h-4 w-20 md:block" />
            <Skeleton className="hidden h-4 w-20 md:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
