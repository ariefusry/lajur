"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { Popover } from "radix-ui";
import { useId, useMemo, useRef, useState } from "react";
import { REGENCIES_BY_PROVINCE } from "@/lib/regencies";
import { cn, selectClass } from "@/lib/utils";

const ALL = Object.entries(REGENCIES_BY_PROVINCE).flatMap(([province, names]) =>
  names.map((name) => ({ name, province })),
);
// "kota bekasi" → "bekasi", so typing the city alone finds both Kota and Kabupaten.
const bare = (s: string) => s.toLowerCase().replace(/^(kota|kabupaten)\s+/, "");

/**
 * Domicile as one of the 514 kabupaten/kota, picked from a searchable list (a plain dropdown that long can't be
 * scrolled through). A value saved before the list existed still shows and submits as it was.
 */
export function DomicilePicker({
  id,
  name,
  defaultValue = "",
  onValueChange,
}: {
  id?: string;
  name: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const listId = useId();

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL;
    return ALL.filter(
      (r) => bare(r.name).includes(bare(q)) || r.name.toLowerCase().includes(q) || r.province.toLowerCase().includes(q),
    );
  }, [query]);

  function pick(v: string) {
    setValue(v);
    onValueChange?.(v);
    setOpen(false);
  }
  function move(to: number) {
    const i = Math.max(0, Math.min(to, matches.length - 1));
    setActive(i);
    list.current?.querySelector(`[data-index="${i}"]`)?.scrollIntoView({ block: "nearest" });
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        setQuery("");
        setActive(
          Math.max(
            0,
            ALL.findIndex((r) => r.name === value),
          ),
        );
      }}
    >
      <Popover.Trigger asChild>
        <button
          id={id}
          type="button"
          className={cn(
            selectClass,
            "flex items-center justify-between gap-2 text-left",
            !value && "text-muted-foreground",
          )}
        >
          <span className="truncate">{value || "Pilih kabupaten/kota"}</span>
          <ChevronDown className="text-muted-foreground size-4 shrink-0" aria-hidden />
        </button>
      </Popover.Trigger>
      <input type="hidden" name={name} value={value} />
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={4}
          // Always opens downward (flipping above the field was confusing on short windows); the list shrinks
          // to the room left below instead, but never under ~5rem so a few options stay reachable.
          avoidCollisions={false}
          className="bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=open]:fade-in-0 z-50 w-[var(--radix-popover-trigger-width)] min-w-64 overflow-hidden rounded-xl border shadow-lg"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).querySelector("input")?.focus();
          }}
        >
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="text-muted-foreground size-4 shrink-0" aria-hidden />
            <input
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={matches[active] ? `${listId}-${active}` : undefined}
              aria-label="Cari kabupaten/kota"
              placeholder="Cari, contoh: Bekasi"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
                list.current?.scrollTo({ top: 0 });
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") move(active + 1);
                else if (e.key === "ArrowUp") move(active - 1);
                else if (e.key === "Enter" && matches[active]) pick(matches[active].name);
                else return;
                e.preventDefault();
              }}
              className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          <div
            ref={list}
            id={listId}
            role="listbox"
            className="max-h-[clamp(5rem,calc(var(--radix-popover-content-available-height)_-_5rem),16rem)] overflow-y-auto overscroll-contain p-1"
          >
            {matches.length === 0 && (
              <p className="text-muted-foreground px-3 py-6 text-center text-sm">Tidak ditemukan</p>
            )}
            {matches.map((r, i) => {
              const newGroup = i === 0 || matches[i - 1].province !== r.province;
              return (
                <div key={`${r.province}-${r.name}`}>
                  {newGroup && (
                    <p className="text-muted-foreground px-2 pt-2 pb-1 text-[11px] font-medium uppercase">
                      {r.province}
                    </p>
                  )}
                  <div
                    id={`${listId}-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={r.name === value}
                    onPointerMove={() => active !== i && setActive(i)}
                    onClick={() => pick(r.name)}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm",
                      i === active && "bg-muted",
                    )}
                  >
                    {r.name}
                    {r.name === value && <Check className="text-primary size-4 shrink-0" aria-hidden />}
                  </div>
                </div>
              );
            })}
          </div>
          {value && (
            <button
              type="button"
              onClick={() => pick("")}
              className="text-muted-foreground hover:text-foreground w-full border-t px-3 py-2 text-left text-sm"
            >
              Hapus pilihan
            </button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
