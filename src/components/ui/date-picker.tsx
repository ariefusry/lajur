"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover } from "radix-ui";
import { useState } from "react";
import { DayPicker, type DropdownProps } from "react-day-picker";
import { id as localeId } from "react-day-picker/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn, selectClass } from "@/lib/utils";

type Props = {
  /** Submitted with the form through a hidden input, in the native inputs' format. */
  name?: string;
  id?: string;
  /** "YYYY-MM-DD", or "YYYY-MM-DDTHH:mm" with `withTime` (same as type="date" / type="datetime-local"). */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Adds a time field next to the date (Jakarta wall-clock time, like the datetime-local it replaces). */
  withTime?: boolean;
  required?: boolean;
  placeholder?: string;
  /** Range of the year dropdown. */
  fromYear?: number;
  toYear?: number;
  className?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

const pad = (n: number) => String(n).padStart(2, "0");
// Calendar days in the browser's own zone, both ways, so no day shifts in between.
const toDate = (day: string) =>
  new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
const toDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const label = (day: string) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(toDate(day));

/** Month/year dropdowns as our own Select: a native <select> list can't use the app's font or colours. */
function CalendarDropdown({ options = [], value, onChange, "aria-label": ariaLabel }: DropdownProps) {
  return (
    <Select
      aria-label={ariaLabel}
      value={String(value)}
      options={options.filter((o) => !o.disabled).map((o) => ({ value: String(o.value), label: o.label }))}
      onValueChange={(v) => onChange?.({ target: { value: v } } as React.ChangeEvent<HTMLSelectElement>)}
      className="h-8 w-auto gap-1 px-2.5 capitalize pointer-coarse:h-9"
    />
  );
}

/**
 * Date field with a calendar drawn by the page (the browser's own date popup can't follow the app's theme or
 * language). Same values as the native inputs, so forms and server parsing don't change.
 */
export function DatePicker({
  name,
  id,
  value,
  defaultValue = "",
  onValueChange,
  withTime,
  required,
  placeholder = "Pilih tanggal",
  fromYear = new Date().getFullYear() - 70,
  toYear = new Date().getFullYear() + 3,
  className,
  ...aria
}: Props) {
  const [inner, setInner] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const current = value ?? inner;
  const day = current.slice(0, 10);
  const time = withTime ? current.slice(11, 16) : "";

  function set(nextDay: string, nextTime = time) {
    const v = nextDay && withTime ? `${nextDay}T${nextTime || "09:00"}` : nextDay;
    setInner(v);
    onValueChange?.(v);
  }
  function pick(nextDay: string) {
    set(nextDay);
    setOpen(false);
  }

  return (
    <div className={cn("relative flex gap-2", className)}>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            id={id}
            type="button"
            {...aria}
            className={cn(
              selectClass,
              "flex min-w-0 flex-1 items-center gap-2 text-left",
              !day && "text-muted-foreground",
            )}
          >
            <CalendarDays className="text-muted-foreground size-4 shrink-0" aria-hidden />
            <span className="truncate">{day ? label(day) : placeholder}</span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={4}
            collisionPadding={8}
            className="bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 z-50 rounded-xl border p-3 shadow-lg"
          >
            <DayPicker
              mode="single"
              locale={localeId}
              selected={day ? toDate(day) : undefined}
              defaultMonth={day ? toDate(day) : undefined}
              onSelect={(d) => d && pick(toDay(d))}
              captionLayout="dropdown"
              startMonth={new Date(fromYear, 0)}
              endMonth={new Date(toYear, 11)}
              components={{
                Dropdown: CalendarDropdown,
                Chevron: ({ orientation }) =>
                  orientation === "left" ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />,
              }}
              classNames={{
                months: "relative",
                month_caption: "flex h-9 items-center pr-20",
                dropdowns: "flex gap-1.5",
                caption_label: "font-medium capitalize",
                nav: "absolute top-0 right-0 flex gap-1",
                button_previous:
                  "hover:bg-muted inline-flex size-9 items-center justify-center rounded-lg disabled:opacity-40",
                button_next:
                  "hover:bg-muted inline-flex size-9 items-center justify-center rounded-lg disabled:opacity-40",
                month_grid: "mt-2 border-collapse",
                weekday: "text-muted-foreground h-8 w-9 text-xs font-normal",
                day: "p-0 text-center text-sm",
                day_button:
                  "hover:bg-primary/10 focus-visible:ring-ring/50 size-9 rounded-lg outline-none focus-visible:ring-2 pointer-coarse:size-10",
                today: "text-primary font-semibold",
                selected: "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary",
                outside: "text-muted-foreground/50",
                disabled: "opacity-40",
              }}
            />
            <div className="mt-2 flex justify-between border-t pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => pick(toDay(new Date()))}>
                Hari ini
              </Button>
              {!required && day && (
                <Button type="button" variant="ghost" size="sm" onClick={() => pick("")}>
                  Hapus
                </Button>
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {withTime && (
        <Input
          type="time"
          aria-label="Jam"
          value={time}
          disabled={!day}
          onChange={(e) => set(day, e.target.value)}
          // Typed only: the browser's clock popup has the same theming problem as its calendar.
          className="w-28 shrink-0 [&::-webkit-calendar-picker-indicator]:hidden"
        />
      )}
      {/* Our own form field, visually hidden but focusable, so `required` still shows the native bubble. */}
      {name && (
        <input
          name={name}
          value={current}
          required={required}
          onChange={() => {}}
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-0 size-px opacity-0"
        />
      )}
    </div>
  );
}
