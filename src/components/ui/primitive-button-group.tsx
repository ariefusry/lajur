import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Segmented control tray: a recessed surface holding a few options, the chosen one raised.
 * Items can be buttons or links (`[&>*]`, not just `[&>button]`), since most of ours navigate.
 * Tokens (--bjork-*) live in globals.css.
 */
function BjorkButtonGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="group"
      className={cn(
        "inline-flex gap-1 rounded-[18px] border border-[color:var(--bjork-border)] bg-[var(--bjork-surface-muted)] p-1.5 shadow-[var(--bjork-shadow-surface)] [&>*]:rounded-[12px]",
        className,
      )}
      {...props}
    />
  );
}

/** Classes for one option in the group: raised when active, muted otherwise. */
export function buttonGroupItemClass(active: boolean, className?: string) {
  return cn(
    "inline-flex h-8 items-center justify-center gap-1.5 border border-transparent px-3 text-sm font-medium whitespace-nowrap transition-[background-color,color,box-shadow] outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.97] pointer-coarse:h-10 [&_svg]:size-4 [&_svg]:shrink-0",
    active
      ? "bg-[var(--bjork-field)] text-[color:var(--bjork-text)] shadow-[var(--bjork-shadow-raised)]"
      : "text-[color:var(--bjork-text-muted)] hover:bg-[var(--bjork-surface-hover)] hover:text-[color:var(--bjork-text)]",
    className,
  );
}

export default BjorkButtonGroup;
