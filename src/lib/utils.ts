export { cn } from "cn"

// Select trigger (components/ui/select.tsx) styled like shadcn Input.
export const selectClass =
  "h-10 pointer-coarse:h-11 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive";

export type SelectOption = { value: string; label: string };

/**
 * `{ KEY: "Label" }` → Select options. Lives here, not in components/ui/select.tsx: that file is "use client",
 * and server components can't call functions exported from a client module.
 */
export const optionsFrom = (labels: Record<string, string>): SelectOption[] =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));
