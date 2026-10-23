import { SkeletonField } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="max-w-7xl space-y-8" role="status" aria-label="Memuat CV">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Versi CV</h1>
        <p className="text-muted-foreground text-sm">
          Simpan setiap versi CV, lalu tautkan ke lamaran supaya ingat versi mana yang dikirim ke mana.
        </p>
      </div>
      <div className="space-y-4">
        <div className="glass grid gap-3 rounded-2xl border p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <SkeletonField />
          <SkeletonField />
          <Skeleton className="h-10 w-20 rounded-lg" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="glass flex items-center gap-3 rounded-2xl border p-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-44" />
              </div>
              <Skeleton className="h-8 w-16 rounded-lg" />
              <Skeleton className="size-8 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
