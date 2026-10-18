import { timingSafeEqual } from "node:crypto";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { followUpDate } from "@/lib/follow-up";
import { dueFollowUp, dueReminder, reminderEmail, type FollowUpItem, type ReminderItem } from "@/lib/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(request.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

type User = { id: string; email: string; name: string | null };
const eventField = (kind: ReminderItem["kind"]) => (kind === "H1" ? "remindedH1At" : "remindedH3At");

// Vercel Cron, daily 00:00 UTC = 07:00 WIB (vercel.json). System job: spans all users by design.
export async function GET(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  const { RESEND_API_KEY, EMAIL_FROM } = process.env;
  if (!RESEND_API_KEY || !EMAIL_FROM) return Response.json({ error: "email not configured" }, { status: 503 });

  const resend = new Resend(RESEND_API_KEY);
  const appUrl = process.env.APP_URL ?? new URL(request.url).origin;
  const now = new Date();
  const userSelect = { select: { id: true, email: true, name: true } } as const;

  const [events, followUpApps] = await Promise.all([
    db.event.findMany({
      where: { startsAt: { gt: now, lte: new Date(now.getTime() + 4 * DAY_MS) } },
      include: { application: { select: { id: true, company: true, position: true, user: userSelect } } },
    }),
    // Follow-ups dated today or earlier (Jakarta) on applications that are still open.
    db.application.findMany({
      where: {
        nextActionAt: { lt: followUpDate(now, 1) },
        followUpRemindedAt: null,
        currentStage: { kind: { in: ["WISHLIST", "IN_PROGRESS", "OFFER"] } },
      },
      select: { id: true, company: true, position: true, nextActionAt: true, followUpRemindedAt: true, user: userSelect },
    }),
  ]);

  const perUser = new Map<string, { user: User; events: { event: (typeof events)[number]; kind: ReminderItem["kind"] }[]; followUps: typeof followUpApps }>();
  const bucket = (user: User) => perUser.get(user.id) ?? perUser.set(user.id, { user, events: [], followUps: [] }).get(user.id)!;
  let due = 0;
  for (const e of events) {
    const kind = dueReminder(e, now);
    if (!kind) continue;
    bucket(e.application.user).events.push({ event: e, kind });
    due++;
  }
  for (const a of followUpApps) {
    if (!dueFollowUp(a, now)) continue;
    bucket(a.user).followUps.push(a);
    due++;
  }

  let sent = 0;
  let failed = 0;
  for (const { user, events: userEvents, followUps } of perUser.values()) {
    // Claim before sending: a concurrent or repeated run can't claim the same reminder twice.
    const claimedEvents: typeof userEvents = [];
    for (const item of userEvents) {
      const field = eventField(item.kind);
      const { count } = await db.event.updateMany({ where: { id: item.event.id, [field]: null }, data: { [field]: now } });
      if (count) claimedEvents.push(item);
    }
    const claimedFollowUps: typeof followUps = [];
    for (const a of followUps) {
      const { count } = await db.application.updateMany({
        where: { id: a.id, followUpRemindedAt: null },
        data: { followUpRemindedAt: now },
      });
      if (count) claimedFollowUps.push(a);
    }
    if (!claimedEvents.length && !claimedFollowUps.length) continue;

    const mail = reminderEmail(
      user.name,
      claimedEvents.map<ReminderItem>(({ event, kind }) => ({
        kind,
        type: event.type,
        startsAt: event.startsAt,
        locationOrUrl: event.locationOrUrl,
        company: event.application.company,
        position: event.application.position,
        applicationId: event.application.id,
      })),
      appUrl,
      claimedFollowUps.map<FollowUpItem>((a) => ({
        company: a.company,
        position: a.position,
        applicationId: a.id,
        nextActionAt: a.nextActionAt!,
      })),
    );
    const { error } = await resend.emails.send({ from: EMAIL_FROM, to: user.email, ...mail });

    if (error) {
      failed++;
      console.error("reminders: send failed", { userId: user.id, error: error.message });
      // Release the claims so tomorrow's run (or a manual re-run) can retry.
      for (const { event, kind } of claimedEvents) {
        const field = eventField(kind);
        await db.event.updateMany({ where: { id: event.id, [field]: now }, data: { [field]: null } });
      }
      for (const a of claimedFollowUps) {
        await db.application.updateMany({ where: { id: a.id, followUpRemindedAt: now }, data: { followUpRemindedAt: null } });
      }
    } else {
      sent++;
    }
  }

  const summary = { checked: events.length + followUpApps.length, due, emailsSent: sent, emailsFailed: failed };
  console.info("reminders: done", summary);
  return Response.json(summary);
}
