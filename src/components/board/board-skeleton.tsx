"use client";

import { useRef } from "react";
import { BOARD_CARD, BOARD_COLUMN, BOARD_SCROLLER, useBoardHeight } from "@/components/board/board-layout";
import { Skeleton } from "@/components/ui/skeleton";

/** The board while it loads: same scroller, column size and full height as the real one, so nothing jumps. */
export function BoardSkeleton() {
  const scroller = useRef<HTMLDivElement>(null);
  useBoardHeight(scroller);
  return (
    <div ref={scroller} className={BOARD_SCROLLER} role="status" aria-label="Memuat board">
      {[2, 2, 1, 1, 1, 1].map((cards, i) => (
        <div key={i} className={BOARD_COLUMN}>
          <div className="flex items-center justify-between px-1.5 pt-0.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-7 rounded-full" />
          </div>
          {Array.from({ length: cards }, (_, j) => (
            <div key={j} className={`${BOARD_CARD} space-y-2.5`}>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3.5 w-1/2" />
              <div className="flex gap-2 pt-0.5">
                <Skeleton className="h-5 w-20 rounded-md" />
                <Skeleton className="h-5 w-16 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
