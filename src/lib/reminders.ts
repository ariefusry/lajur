import { daysUntil, formatDateTime } from "@/lib/dates";
import { EVENT_TYPE_LABELS } from "@/lib/validation";
import type { EventType } from "@/generated/prisma/enums";

export type ReminderKind = "H3" | "H1";

type EventLike = { startsAt: Date; remindedH3At: Date | null; remindedH1At: Date | null };

/**
 * Which reminder (if any) is due today, in Jakarta calendar days.
 * H-3 also fires at H-2 so one missed cron run doesn't drop it; H-1 supersedes it.
 */
export function dueReminder(event: EventLike, now: Date): ReminderKind | null {
  const days = daysUntil(event.startsAt, now);
  if (days === 1 && !event.remindedH1At) return "H1";
  if ((days === 2 || days === 3) && !event.remindedH3At) return "H3";
  return null;
}

export type ReminderItem = {
  kind: ReminderKind;
  type: EventType;
  startsAt: Date;
  locationOrUrl: string | null;
  company: string;
  position: string;
  applicationId: string;
};

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function reminderEmail(name: string | null, items: ReminderItem[], appUrl: string) {
  const line = (i: ReminderItem) =>
    `${i.kind === "H1" ? "BESOK" : "H-3"} · ${EVENT_TYPE_LABELS[i.type]} · ${i.company} (${i.position}) · ${formatDateTime(i.startsAt)}` +
    (i.locationOrUrl ? ` · ${i.locationOrUrl}` : "");
  const hasTomorrow = items.some((i) => i.kind === "H1");

  const subject = hasTomorrow
    ? `Pengingat: ${items.length} jadwal seleksi, ada yang besok`
    : `Pengingat: ${items.length} jadwal seleksi dalam 3 hari`;

  const text = [
    `Halo${name ? ` ${name}` : ""},`,
    "",
    "Jadwal seleksi kamu yang akan datang:",
    ...items.map((i) => `- ${line(i)}\n  ${appUrl}/applications/${i.applicationId}`),
    "",
    "Semoga lancar!",
    "Lamarin",
  ].join("\n");

  const html = `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.5;color:#111">
<p>Halo${name ? ` ${escape(name)}` : ""},</p>
<p>Jadwal seleksi kamu yang akan datang:</p>
<ul style="padding-left:18px">${items
    .map(
      (i) =>
        `<li style="margin-bottom:8px"><a href="${escape(`${appUrl}/applications/${i.applicationId}`)}">${escape(line(i))}</a></li>`,
    )
    .join("")}</ul>
<p>Semoga lancar!<br>Lamarin</p>
</div>`;

  return { subject, text, html };
}
