import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex gap-3 overflow-hidden" role="status" aria-label="Memuat board">
      {[3, 2, 1, 2, 1].map((cards, i) => (
        <div key={i} className="bg-muted/50 w-[min(16rem,80vw)] shrink-0 space-y-2 rounded-xl p-2">
          <Skeleton className="h-4 w-24" />
          {Array.from({ length: cards }, (_, j) => (
            <Skeleton key={j} className="bg-background h-24 w-full rounded-lg" />
          ))}
        </div>
      ))}
    </div>
  );
}
