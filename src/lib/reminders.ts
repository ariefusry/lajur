import { daysUntil, formatDate, formatDateTime } from "@/lib/dates";
import { isFollowUpDue } from "@/lib/follow-up";
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

/** A follow-up is mailed once, on (or after, if a run was missed) its date. */
export const dueFollowUp = (app: { nextActionAt: Date | null; followUpRemindedAt: Date | null }, now: Date) =>
  isFollowUpDue(app.nextActionAt, now) && !app.followUpRemindedAt;

export type ReminderItem = {
  kind: ReminderKind;
  type: EventType;
  startsAt: Date;
  locationOrUrl: string | null;
  company: string;
  position: string;
  applicationId: string;
};

export type FollowUpItem = { company: string; position: string; applicationId: string; nextActionAt: Date };

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function reminderEmail(name: string | null, items: ReminderItem[], appUrl: string, followUps: FollowUpItem[] = []) {
  const eventLine = (i: ReminderItem) =>
    `${i.kind === "H1" ? "BESOK" : "H-3"} · ${EVENT_TYPE_LABELS[i.type]} · ${i.company} (${i.position}) · ${formatDateTime(i.startsAt)}` +
    (i.locationOrUrl ? ` · ${i.locationOrUrl}` : "");
  const followUpLine = (f: FollowUpItem) => `${f.company} (${f.position}) · jadwal follow-up ${formatDate(f.nextActionAt)}`;
  const hasTomorrow = items.some((i) => i.kind === "H1");
  const link = (id: string) => `${appUrl}/applications/${id}`;

  const subject = items.length
    ? (hasTomorrow
        ? `Pengingat: ${items.length} jadwal seleksi, ada yang besok`
        : `Pengingat: ${items.length} jadwal seleksi dalam 3 hari`) + (followUps.length ? ` + ${followUps.length} follow-up` : "")
    : `Pengingat: ${followUps.length} lamaran perlu di-follow-up hari ini`;

  const text = [
    `Halo${name ? ` ${name}` : ""},`,
    ...(items.length
      ? ["", "Jadwal seleksi kamu yang akan datang:", ...items.map((i) => `- ${eventLine(i)}\n  ${link(i.applicationId)}`)]
      : []),
    ...(followUps.length
      ? ["", "Saatnya follow-up:", ...followUps.map((f) => `- ${followUpLine(f)}\n  ${link(f.applicationId)}`)]
      : []),
    "",
    "Semoga lancar!",
    "Lamarin",
  ].join("\n");

  const list = (lines: { text: string; id: string }[]) =>
    `<ul style="padding-left:18px">${lines
      .map((l) => `<li style="margin-bottom:8px"><a href="${escape(link(l.id))}">${escape(l.text)}</a></li>`)
      .join("")}</ul>`;
  const html = `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.5;color:#111">
<p>Halo${name ? ` ${escape(name)}` : ""},</p>
${items.length ? `<p>Jadwal seleksi kamu yang akan datang:</p>\n${list(items.map((i) => ({ text: eventLine(i), id: i.applicationId })))}` : ""}
${followUps.length ? `<p>Saatnya follow-up:</p>\n${list(followUps.map((f) => ({ text: followUpLine(f), id: f.applicationId })))}` : ""}
<p>Semoga lancar!<br>Lamarin</p>
</div>`;

  return { subject, text, html };
}
