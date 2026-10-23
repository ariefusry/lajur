import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { AddToCalendar } from "@/components/add-to-calendar";
import { Button } from "@/components/ui/button";
import type { EventType } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatEventWhenShort, formatTime, fromDateInput, toDateInput } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { EVENT_TYPE_LABELS } from "@/lib/validation";

export const metadata = { title: "Kalender · Lajur" };

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const pad = (n: number) => String(n).padStart(2, "0");

// Phone cells fit ~6 characters: drop legal-form noise so the recognisable part shows ("PT Bank Mandiri (Persero) Tbk" → "Bank Mandiri").
const shortCompany = (name: string) =>
  name
    .replace(/^(PT|CV)\.?\s+/i, "")
    .replace(/\s*\(Persero\)|\s+Tbk\.?/gi, "")
    .trim() || name;

// Colour says what kind of day it is, not which application (the chip already names the company).
const KINDS = [
  { label: "Deadline", types: ["DEADLINE"], chip: "bg-destructive/15 text-destructive", dot: "bg-destructive" },
  {
    label: "Tes",
    types: ["ONLINE_TEST", "PSYCHOTEST", "LGD"],
    chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  {
    label: "Interview",
    types: ["INTERVIEW_HR", "INTERVIEW_USER"],
    chip: "bg-primary/15 text-primary",
    dot: "bg-primary",
  },
  {
    label: "MCU & lainnya",
    types: ["MCU", "OTHER"],
    chip: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
] satisfies { label: string; types: EventType[]; chip: string; dot: string }[];
const kindOf = (type: EventType) => KINDS.find((k) => (k.types as EventType[]).includes(type))!;

type Item = {
  key: string;
  at: Date;
  label: string;
  company: string;
  applicationId: string;
  type: EventType;
  isDeadline: boolean;
  location?: string | null;
  allDay?: boolean;
  opensAt?: Date | null;
};

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireUser();
  const today = toDateInput(new Date());
  const param = (await searchParams).month;
  const [year, month] = (/^\d{4}-\d{2}$/.test(param ?? "") ? param! : today.slice(0, 7)).split("-").map(Number);

  // Jakarta has no DST, so calendar-day arithmetic in UTC is exact.
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leading = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7; // Monday-first
  const monthKey = `${year}-${pad(month)}`;
  const prev = month === 1 ? `${year - 1}-12` : `${year}-${pad(month - 1)}`;
  const next = month === 12 ? `${year + 1}-01` : `${year}-${pad(month + 1)}`;
  const from = fromDateInput(`${monthKey}-01`);
  const to = fromDateInput(`${next}-01`);

  const [events, deadlines] = await Promise.all([
    db.event.findMany({
      // A window (opensAt → startsAt) shows in every month it overlaps.
      where: {
        application: { userId: user.id },
        startsAt: { gte: from },
        OR: [{ opensAt: { lt: to } }, { opensAt: null, startsAt: { lt: to } }],
      },
      include: { application: { select: { id: true, company: true } } },
      orderBy: { startsAt: "asc" },
    }),
    db.application.findMany({
      where: { userId: user.id, deadline: { gte: from, lt: to } },
      select: { id: true, company: true, deadline: true },
    }),
  ]);

  const items: Item[] = [
    ...events.map((e) => ({
      key: e.id,
      at: e.startsAt,
      opensAt: e.opensAt,
      label: EVENT_TYPE_LABELS[e.type],
      company: e.application.company,
      applicationId: e.application.id,
      type: e.type,
      isDeadline: e.type === "DEADLINE",
      location: e.locationOrUrl,
    })),
    ...deadlines.map((a) => ({
      key: `deadline-${a.id}`,
      at: a.deadline!,
      label: "Deadline pendaftaran",
      allDay: true,
      company: a.company,
      applicationId: a.id,
      type: "DEADLINE" as const,
      isDeadline: true,
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  // A window fills every day it spans, clipped to this month.
  const monthEnd = `${monthKey}-${pad(daysInMonth)}`;
  const byDay = new Map<string, Item[]>();
  for (const it of items) {
    const first = toDateInput(it.opensAt ?? it.at);
    const last = toDateInput(it.at);
    const end = Date.parse(last < monthEnd ? last : monthEnd);
    for (let t = Date.parse(first > `${monthKey}-01` ? first : `${monthKey}-01`); t <= end; t += 86_400_000) {
      const day = new Date(t).toISOString().slice(0, 10);
      byDay.set(day, [...(byDay.get(day) ?? []), it]);
    }
  }
  // Multi-day windows go first, oldest start first, so a bar keeps its row across the days it spans.
  // ponytail: two overlapping windows can still swap rows; per-week lane assignment if that bites.
  const span = (it: Item) => toDateInput(it.opensAt ?? it.at) !== toDateInput(it.at);
  for (const list of byDay.values())
    list.sort(
      (a, b) => Number(span(b)) - Number(span(a)) || (a.opensAt ?? a.at).getTime() - (b.opensAt ?? b.at).getTime(),
    );
  const title = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight capitalize">{title}</h1>
        <div className="flex gap-1">
          <Button asChild variant="outline" size="icon-sm" aria-label="Bulan sebelumnya">
            <Link href={`/calendar?month=${prev}`}>
              <ChevronLeft />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/calendar">Hari ini</Link>
          </Button>
          <Button asChild variant="outline" size="icon-sm" aria-label="Bulan berikutnya">
            <Link href={`/calendar?month=${next}`}>
              <ChevronRight />
            </Link>
          </Button>
        </div>
      </div>

      <div className="glass grid grid-cols-7 overflow-hidden rounded-2xl border text-xs">
        {WEEKDAYS.map((d) => (
          <div key={d} className="bg-muted/50 border-b p-2 text-center font-medium">
            {d}
          </div>
        ))}
        {Array.from({ length: leading }, (_, i) => (
          <div key={`pad-${i}`} className="bg-muted/20 min-h-16 border-b border-l first:border-l-0 md:min-h-24" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = `${monthKey}-${pad(i + 1)}`;
          const dayItems = byDay.get(day) ?? [];
          return (
            <div
              key={day}
              className={cn(
                "min-h-16 space-y-1 border-b border-l p-1 md:min-h-24",
                (leading + i) % 7 === 0 && "border-l-0",
              )}
            >
              <span
                className={cn(
                  "inline-flex size-6 items-center justify-center rounded-full",
                  day === today && "bg-primary text-primary-foreground",
                )}
              >
                {i + 1}
              </span>
              {dayItems.slice(0, 3).map((it) => {
                // A window is one bar: square, cell-bridging edges where it continues, label only where a row of it starts.
                const opensHere = day === toDateInput(it.opensAt ?? it.at);
                const endsHere = day === toDateInput(it.at);
                const rowStart = opensHere || (leading + i) % 7 === 0 || i === 0;
                return (
                  <Link
                    key={it.key}
                    href={`/applications/${it.applicationId}`}
                    title={`${it.label} · ${it.company}`}
                    className={cn(
                      "block rounded px-1 py-0.5 text-[10px] leading-snug font-medium md:truncate md:text-xs",
                      kindOf(it.type).chip,
                      !opensHere && "-ml-1 rounded-l-none",
                      !endsHere && "-mr-1 rounded-r-none",
                    )}
                  >
                    <span className={cn("contents", !rowStart && "[&>*]:invisible")}>
                      {/* Phones: first word, then the rest, each line cut with "…" (never split inside a word). */}
                      <span className="hidden md:inline">{shortCompany(it.company)}</span>
                      {shortCompany(it.company)
                        .split(/\s+(.*)/, 2)
                        .filter(Boolean)
                        .map((line, n) => (
                          <span key={n} className="block truncate md:hidden">
                            {line}
                          </span>
                        ))}
                    </span>
                  </Link>
                );
              })}
              {dayItems.length > 3 && <p className="text-muted-foreground px-1">+{dayItems.length - 3} lagi</p>}
            </div>
          );
        })}
      </div>

      <ul className="text-muted-foreground -mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {KINDS.map((k) => (
          <li key={k.label} className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", k.dot)} />
            {k.label}
          </li>
        ))}
      </ul>

      <section className="space-y-2">
        <h2 className="font-medium">Agenda bulan ini</h2>
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Tidak ada jadwal. Tambahkan jadwal tes atau interview dari halaman detail lamaran.
          </p>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {items.map((it) => {
              const start = toDateInput(it.opensAt ?? it.at);
              const kind = kindOf(it.type);
              return (
                <li key={it.key} className="glass flex items-center gap-1 overflow-hidden rounded-2xl border pr-2">
                  <Link
                    href={`/applications/${it.applicationId}`}
                    className="hover:bg-muted/50 flex min-w-0 flex-1 items-center gap-3 p-3"
                  >
                    {/* Date tile in the kind's colour: the day is readable at a glance, the line beside it says what. */}
                    <span
                      className={cn(
                        "flex size-11 shrink-0 flex-col items-center justify-center rounded-xl leading-none",
                        kind.chip,
                      )}
                    >
                      <span className="text-base font-semibold tabular-nums">{Number(start.slice(8))}</span>
                      <span className="mt-0.5 text-[10px] font-medium uppercase">
                        {MONTHS_SHORT[Number(start.slice(5, 7)) - 1]}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{it.company}</span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {it.label}
                        {!it.allDay &&
                          ` · ${
                            it.opensAt
                              ? `${formatEventWhenShort({ startsAt: it.at, opensAt: it.opensAt })} WIB`
                              : formatTime(it.at)
                          }`}
                      </span>
                    </span>
                  </Link>
                  <AddToCalendar
                    title={`${it.label} · ${it.company}`}
                    start={it.opensAt ?? it.at}
                    end={it.opensAt ? it.at : undefined}
                    allDay={it.allDay}
                    location={it.location}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
