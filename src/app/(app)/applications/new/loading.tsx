import { Skeleton } from "@/components/ui/skeleton";

// The usual case: the "Tambah dengan AI" panel, with "Isi manual tanpa AI" beside it.
export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-label="Memuat formulir">
      <h1 className="text-2xl font-semibold tracking-tight">Lamaran baru</h1>
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start">
        <div className="glass space-y-3 rounded-2xl border p-4">
          <Skeleton className="h-5 w-40" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-56 rounded-lg" />
          <Skeleton className="h-9 w-44 rounded-lg" />
          <Skeleton className="h-10 w-40 rounded-lg" />
        </div>
        <Skeleton className="h-10 w-40 rounded-lg" />
      </div>
    </div>
  );
}
