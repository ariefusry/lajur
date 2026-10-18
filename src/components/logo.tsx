import { cn } from "@/lib/utils";

/**
 * The Lajur mark: an L built from two cards, the column and the card just moved one column over
 * (masters and guidelines in docs/brand). Inherits colour from `currentColor`; brand blue by default.
 */
export function LogoMark({ className, small }: { className?: string; small?: boolean }) {
  return (
    <svg viewBox="0 0 256 256" aria-hidden className={cn("size-6 shrink-0 fill-current", className)}>
      {small ? (
        // Small-size cut (≤ 20 px): wider gap so the two cards never merge.
        <>
          <rect x="48" y="32" width="64" height="192" rx="16" />
          <rect x="140" y="156" width="68" height="68" rx="16" />
        </>
      ) : (
        <>
          <rect x="57" y="27" width="60" height="200" rx="22" />
          <rect x="131" y="159" width="68" height="68" rx="22" />
        </>
      )}
    </svg>
  );
}

/** Mark + wordmark (live Geist text, so it stays crisp and readable by screen readers as "Lajur"). */
export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark className={cn("text-primary", markClassName)} />
      Lajur
    </span>
  );
}
