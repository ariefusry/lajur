"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Inline confirmation that replaces the browser's confirm() dialog: message plus confirm/cancel buttons. */
export function ConfirmBar({
  message,
  confirmLabel,
  destructive = true,
  disabled,
  onConfirm,
  onCancel,
  className,
}: {
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  className?: string;
}) {
  return (
    <div
      role="alertdialog"
      aria-label={message}
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-xl border p-3",
        destructive ? "bg-destructive/5 border-destructive/20" : "bg-primary/5 border-primary/20",
        className,
      )}
    >
      <p className="min-w-0 flex-1 text-sm">{message}</p>
      <Button
        type="button"
        size="sm"
        variant={destructive ? "destructive" : "default"}
        disabled={disabled}
        onClick={onConfirm}
        autoFocus
      >
        {confirmLabel}
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={onCancel}>
        Batal
      </Button>
    </div>
  );
}
