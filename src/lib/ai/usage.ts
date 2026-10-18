import "server-only";
import type { AiFeature } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { toDateInput } from "@/lib/dates";
import { isDemoEmail } from "@/lib/demo";


export class QuotaExceededError extends Error {
  constructor() {
    super("Kuota AI hari ini habis, isi manual dulu ya");
  }
}

/** Today's Jakarta date as a @db.Date value (UTC midnight of that calendar day). */
function jakartaDay() {
  return new Date(`${toDateInput(new Date())}T00:00:00Z`);
}

// Check-then-call isn't atomic, so two parallel requests can overshoot by one. Fine for a daily soft cap.
export async function assertQuota(userId: string) {
  const [user, used] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { email: true } }),
    db.aiUsage.aggregate({ where: { userId, day: jakartaDay() }, _sum: { count: true } }),
  ]);
  const limit = Number(
    isDemoEmail(user?.email) ? (process.env.AI_DAILY_LIMIT_DEMO ?? 10) : (process.env.AI_DAILY_LIMIT_PER_USER ?? 30),
  );
  if ((used._sum.count ?? 0) >= limit) throw new QuotaExceededError();
}

export async function recordUsage(userId: string, feature: AiFeature, model: string) {
  const day = jakartaDay();
  await db.aiUsage.upsert({
    where: { userId_day_feature_model: { userId, day, feature, model } },
    create: { userId, day, feature, model, count: 1 },
    update: { count: { increment: 1 } },
  });
}
