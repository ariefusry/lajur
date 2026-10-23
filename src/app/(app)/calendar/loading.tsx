import { Skeleton } from "@/components/ui/skeleton";

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-label="Memuat kalender">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-1.5">
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="size-8 rounded-lg" />
        </div>
      </div>
      <div className="glass grid grid-cols-7 overflow-hidden rounded-2xl border text-xs">
        {WEEKDAYS.map((d) => (
          <div key={d} className="bg-muted/50 border-b p-2 text-center font-medium">
            {d}
          </div>
        ))}
        {Array.from({ length: 35 }, (_, i) => (
          <div key={i} className={`min-h-16 border-b p-2 md:min-h-24 ${i % 7 ? "border-l" : ""}`}>
            <Skeleton className="h-3 w-4" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-36" />
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="glass flex items-center gap-3 rounded-2xl border p-3">
              <Skeleton className="size-11 shrink-0 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
