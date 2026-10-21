"use client";

import { Check, ChevronDown } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import { useState } from "react";
import { cn, selectClass, type SelectOption } from "@/lib/utils";

// Radix reserves "" for "nothing selected", so an option whose value is "" ("Semua tahap") gets a stand-in.
const EMPTY = "__empty__";

export type { SelectOption };

type SelectProps = {
  options: SelectOption[];
  /** Submitted with the form through a hidden input (same as a native select's name). */
  name?: string;
  id?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Shown while nothing is chosen (the old disabled "Pilih …" option). */
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  /** Replaces the field-style trigger, e.g. with an icon button (the kanban card's "move to stage"). */
  trigger?: React.ReactElement;
};

/**
 * Dropdown drawn by the page itself, not the operating system: native option lists can only use installed
 * fonts (so they fell back to a serif) and look different in every browser. Keyboard and screen reader
 * behaviour come from Radix.
 */
export function Select({
  options,
  name,
  value,
  defaultValue = "",
  onValueChange,
  placeholder,
  required,
  disabled,
  className,
  trigger,
  ...triggerProps
}: SelectProps) {
  const [inner, setInner] = useState(defaultValue);
  // Set when the browser rejects the form because this required field is empty; cleared by choosing a value.
  const [missing, setMissing] = useState(false);
  const current = value ?? inner;
  const hasEmptyOption = options.some((o) => o.value === "");

  return (
    <>
      <SelectPrimitive.Root
        value={current === "" ? (hasEmptyOption ? EMPTY : "") : current}
        onValueChange={(v) => {
          const real = v === EMPTY ? "" : v;
          setInner(real);
          setMissing(false);
          onValueChange?.(real);
        }}
        disabled={disabled}
      >
        {trigger ? (
          <SelectPrimitive.Trigger {...triggerProps} asChild>
            {trigger}
          </SelectPrimitive.Trigger>
        ) : (
          <SelectPrimitive.Trigger
            {...triggerProps}
            aria-invalid={triggerProps["aria-invalid"] || (missing && required) || undefined}
            className={cn(
              selectClass,
              "data-placeholder:text-muted-foreground flex items-center justify-between gap-2 text-left disabled:opacity-50",
              className,
            )}
          >
            <span className="min-w-0 truncate">
              <SelectPrimitive.Value placeholder={placeholder} />
            </span>
            <SelectPrimitive.Icon asChild>
              <ChevronDown className="text-muted-foreground size-4 shrink-0" />
            </SelectPrimitive.Icon>
          </SelectPrimitive.Trigger>
        )}
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={4}
            className="bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 z-50 max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) origin-(--radix-select-content-transform-origin) overflow-hidden rounded-xl border p-1 shadow-lg"
          >
            <SelectPrimitive.Viewport>
              {options.map((o) => (
                <SelectPrimitive.Item
                  key={o.value || EMPTY}
                  value={o.value || EMPTY}
                  className="data-highlighted:bg-primary/10 data-[state=checked]:text-primary relative flex cursor-default items-center rounded-lg py-2 pr-3 pl-8 text-sm outline-none select-none data-[state=checked]:font-medium pointer-coarse:py-2.5"
                >
                  <SelectPrimitive.ItemIndicator className="absolute left-2.5">
                    <Check className="size-4" />
                  </SelectPrimitive.ItemIndicator>
                  <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
      {/* Our own form field (Radix's would submit the "" stand-in). Visually hidden but focusable by the
          browser, so `required` still shows the native "please choose" bubble. */}
      {name && (
        <input
          name={name}
          value={current}
          required={required}
          onChange={() => {}}
          onInvalid={() => setMissing(true)}
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none absolute size-px opacity-0"
        />
      )}
    </>
  );
}
