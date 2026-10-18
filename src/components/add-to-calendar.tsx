import { CalendarPlus } from "lucide-react";
import { googleCalendarUrl } from "@/lib/google-calendar";
import { cn } from "@/lib/utils";

/** Icon link that opens Google Calendar with the event prefilled (works for any visitor, demo included). */
export function AddToCalendar({
  className,
  ...event
}: Parameters<typeof googleCalendarUrl>[0] & { className?: string }) {
  return (
    <a
      href={googleCalendarUrl(event)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Tambah "${event.title}" ke Google Calendar`}
      title="Tambah ke Google Calendar"
      className={cn(
        "text-muted-foreground hover:bg-foreground/5 hover:text-foreground inline-flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors pointer-coarse:size-11",
        className,
      )}
    >
      <CalendarPlus className="size-4" />
    </a>
  );
}
