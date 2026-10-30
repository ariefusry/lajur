"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";

const DEFAULT_SORT = "updated";
const TYPING_DELAY_MS = 300;

/**
 * Search, stage and sort of the applications list. They apply as soon as they change (typing after a short
 * pause, dropdowns at once) by replacing the URL, so the filters still survive reloads and can be bookmarked.
 */
export function ApplicationFilters({
  query,
  stage,
  sort,
  stageOptions,
  sortOptions,
  filtered,
}: {
  query: string;
  stage: string;
  sort: string;
  stageOptions: SelectOption[];
  sortOptions: SelectOption[];
  filtered: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(query);
  const [stageValue, setStageValue] = useState(stage);
  const [sortValue, setSortValue] = useState(sort);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Back/forward changes the URL without going through this form; typed trailing spaces are not overwritten.
  useEffect(() => {
    setQ((current) => (current.trim() === query ? current : query));
    setStageValue(stage);
    setSortValue(sort);
  }, [query, stage, sort]);
  useEffect(() => () => clearTimeout(timer.current), []);

  function go(next: { q: string; stage: string; sort: string }) {
    clearTimeout(timer.current);
    const params = new URLSearchParams();
    if (next.q.trim()) params.set("q", next.q.trim());
    if (next.stage) params.set("stage", next.stage);
    if (next.sort && next.sort !== DEFAULT_SORT) params.set("sort", next.sort);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        go({ q, stage: stageValue, sort: sortValue });
      }}
    >
      <label className="relative basis-full sm:min-w-48 sm:flex-1 sm:basis-auto">
        <span className="sr-only">Cari</span>
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          name="q"
          value={q}
          onChange={(e) => {
            const value = e.target.value;
            setQ(value);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => go({ q: value, stage: stageValue, sort: sortValue }), TYPING_DELAY_MS);
          }}
          placeholder="Cari perusahaan, posisi, atau lokasi"
          className="pl-9"
        />
      </label>
      <label className="relative flex-1 sm:flex-none">
        <span className="sr-only">Tahap</span>
        <Select
          name="stage"
          value={stageValue}
          onValueChange={(value) => {
            setStageValue(value);
            go({ q, stage: value, sort: sortValue });
          }}
          className="w-full sm:w-44"
          options={stageOptions}
        />
      </label>
      <label className="relative flex-1 sm:flex-none">
        <span className="sr-only">Urutkan</span>
        <Select
          name="sort"
          value={sortValue}
          onValueChange={(value) => {
            setSortValue(value);
            go({ q, stage: stageValue, sort: value });
          }}
          className="w-full sm:w-44"
          options={sortOptions}
        />
      </label>
      {filtered && (
        <Button
          type="button"
          variant="ghost"
          className="h-10 pointer-coarse:h-11"
          onClick={() => {
            setQ("");
            setStageValue("");
            setSortValue(DEFAULT_SORT);
            go({ q: "", stage: "", sort: DEFAULT_SORT });
          }}
        >
          Reset
        </Button>
      )}
    </form>
  );
}
