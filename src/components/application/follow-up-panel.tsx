"use client";

import { BellRing } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateFollowUp } from "@/actions/follow-up";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { FOLLOW_UP_INTERVALS } from "@/lib/follow-up";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  /** "YYYY-MM-DD" (Jakarta) or "" when none is scheduled. */
  next: string;
  nextLabel: string | null;
  lastLabel: string | null;
  due: boolean;
};

/** Record a follow-up ("sudah follow-up, ingatkan lagi N hari") or pick the date to chase the company next. */
export function FollowUpPanel({ id, next, nextLabel, lastLabel, due }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [inDays, setInDays] = useState("7");
  const [date, setDate] = useState(next);

  function run(input: Record<string, string>) {
    startTransition(async () => {
      const res = await updateFollowUp(id, input).catch(() => ({ ok: false, message: "Gagal menyimpan. Coba lagi." }));
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
      router.refresh();
    });
  }

  return (
    <section className="glass space-y-3 rounded-2xl border p-4" aria-labelledby="follow-up-title">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 id="follow-up-title" className="font-semibold">
            Follow-up
          </h2>
          <p className="text-muted-foreground text-xs">
            {nextLabel ? `Berikutnya: ${nextLabel}` : "Belum dijadwalkan."}
            {lastLabel && ` · Terakhir: ${lastLabel}`}
          </p>
        </div>
        {nextLabel && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
              due ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
            )}
          >
            <BellRing className="size-3" aria-hidden />
            {due ? "Jatuh tempo" : "Terjadwal"}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          className="h-10 pointer-coarse:h-11"
          disabled={pending}
          onClick={() => run({ mode: "done", inDays })}
        >
          Sudah follow-up
        </Button>
        <Select
          value={inDays}
          onValueChange={setInDays}
          aria-label="Ingatkan lagi dalam"
          className="min-w-36 flex-1"
          options={FOLLOW_UP_INTERVALS.map((n) => ({ value: String(n), label: `Ingatkan ${n} hari lagi` }))}
        />
      </div>

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (date) run({ mode: "schedule", date });
        }}
      >
        <label htmlFor={`${id}-follow-up-date`} className="sr-only">
          Tanggal follow-up
        </label>
        <DatePicker id={`${id}-follow-up-date`} value={date} onValueChange={setDate} className="min-w-0 flex-1" />
        <Button type="submit" variant="outline" className="h-10 pointer-coarse:h-11" disabled={pending || !date}>
          Atur tanggal
        </Button>
        {nextLabel && (
          <Button type="button" variant="ghost" disabled={pending} onClick={() => run({ mode: "clear" })}>
            Hapus
          </Button>
        )}
      </form>
      <p className="text-muted-foreground text-xs">Email pengingat dikirim pada tanggalnya, pukul 07.00 WIB.</p>
    </section>
  );
}
