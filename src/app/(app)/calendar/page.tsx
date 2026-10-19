import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { AddToCalendar } from "@/components/add-to-calendar";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatEventWhen, fromDateInput, toDateInput } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { EVENT_TYPE_LABELS } from "@/lib/validation";

export const metadata = { title: "Kalender · Lajur" };

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const pad = (n: number) => String(n).padStart(2, "0");

// Phone cells fit ~6 characters: drop legal-form noise so the recognisable part shows ("PT Bank Mandiri (Persero) Tbk" → "Bank Mandiri").
const shortCompany = (name: string) =>
  name
    .replace(/^(PT|CV)\.?\s+/i, "")
    .replace(/\s*\(Persero\)|\s+Tbk\.?/gi, "")
    .trim() || name;

type Item = {
  key: string;
  at: Date;
  label: string;
  company: string;
  applicationId: string;
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
      where: { application: { userId: user.id }, startsAt: { gte: from, lt: to } },
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
      isDeadline: true,
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  const byDay = Map.groupBy(items, (i) => toDateInput(i.at));
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
              {dayItems.slice(0, 3).map((it) => (
                <Link
                  key={it.key}
                  href={`/applications/${it.applicationId}`}
                  title={`${it.label} · ${it.company}`}
                  className={cn(
                    "block rounded px-1 py-0.5 text-[10px] leading-snug font-medium md:truncate md:text-xs",
                    it.isDeadline ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary",
                  )}
                >
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
                </Link>
              ))}
              {dayItems.length > 3 && <p className="text-muted-foreground px-1">+{dayItems.length - 3} lagi</p>}
            </div>
          );
        })}
      </div>

      <section className="space-y-2">
        <h2 className="font-medium">Agenda bulan ini</h2>
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Tidak ada jadwal. Tambahkan jadwal tes atau interview dari halaman detail lamaran.
          </p>
        ) : (
          <ul className="glass max-w-2xl divide-y rounded-2xl border">
            {items.map((it) => (
              <li key={it.key} className="flex items-center gap-1 pr-2">
                <Link
                  href={`/applications/${it.applicationId}`}
                  className="hover:bg-muted/50 grid min-w-0 flex-1 gap-x-3 gap-y-0.5 p-3 text-sm sm:grid-cols-[10rem_1fr_auto] sm:items-center"
                >
                  <span className="min-w-0 truncate font-medium sm:order-2">{it.company}</span>
                  <span
                    className={cn(
                      "text-xs sm:order-1 sm:text-sm",
                      it.isDeadline ? "text-destructive" : "text-muted-foreground sm:text-foreground",
                    )}
                  >
                    {it.label}
                  </span>
                  <span className="text-muted-foreground text-xs sm:order-3 sm:text-sm">
                    {formatEventWhen({ startsAt: it.at, opensAt: it.opensAt ?? null })}
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
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
