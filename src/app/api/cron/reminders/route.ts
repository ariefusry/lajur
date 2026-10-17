import { timingSafeEqual } from "node:crypto";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { dueReminder, reminderEmail, type ReminderItem } from "@/lib/reminders";

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

// Vercel Cron, daily 00:00 UTC = 07:00 WIB (vercel.json). System job: spans all users by design.
export async function GET(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  const { RESEND_API_KEY, EMAIL_FROM } = process.env;
  if (!RESEND_API_KEY || !EMAIL_FROM) return Response.json({ error: "email not configured" }, { status: 503 });

  const resend = new Resend(RESEND_API_KEY);
  const appUrl = process.env.APP_URL ?? new URL(request.url).origin;
  const now = new Date();

  const events = await db.event.findMany({
    where: { startsAt: { gt: now, lte: new Date(now.getTime() + 4 * DAY_MS) } },
    include: {
      application: {
        select: { id: true, company: true, position: true, user: { select: { id: true, email: true, name: true } } },
      },
    },
  });

  const due = events.flatMap((e) => {
    const kind = dueReminder(e, now);
    return kind ? [{ event: e, kind }] : [];
  });
  const byUser = Map.groupBy(due, (d) => d.event.application.user.id);

  let sent = 0;
  let failed = 0;
  for (const items of byUser.values()) {
    const user = items[0].event.application.user;

    // Claim before sending: a concurrent or repeated run can't claim the same reminder twice.
    const claimed: typeof items = [];
    for (const item of items) {
      const field = item.kind === "H1" ? "remindedH1At" : "remindedH3At";
      const { count } = await db.event.updateMany({
        where: { id: item.event.id, [field]: null },
        data: { [field]: now },
      });
      if (count) claimed.push(item);
    }
    if (!claimed.length) continue;

    const mail = reminderEmail(
      user.name,
      claimed.map<ReminderItem>(({ event, kind }) => ({
        kind,
        type: event.type,
        startsAt: event.startsAt,
        locationOrUrl: event.locationOrUrl,
        company: event.application.company,
        position: event.application.position,
        applicationId: event.application.id,
      })),
      appUrl,
    );
    const { error } = await resend.emails.send({ from: EMAIL_FROM, to: user.email, ...mail });

    if (error) {
      failed++;
      console.error("reminders: send failed", { userId: user.id, error: error.message });
      // Release the claims so tomorrow's run (or a manual re-run) can retry.
      for (const { event, kind } of claimed) {
        const field = kind === "H1" ? "remindedH1At" : "remindedH3At";
        await db.event.updateMany({ where: { id: event.id, [field]: now }, data: { [field]: null } });
      }
    } else {
      sent++;
    }
  }

  console.info("reminders: done", { checked: events.length, due: due.length, emailsSent: sent, emailsFailed: failed });
  return Response.json({ checked: events.length, due: due.length, emailsSent: sent, emailsFailed: failed });
}
