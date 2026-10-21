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

/**
 * Today's AI uses against the daily limit. Reading a poster (READ_POSTER) is recorded but not counted: its vision
 * model has its own provider allowance, and the extraction that follows already counts, so a poster costs one.
 */
export async function getQuota(userId: string) {
  const [user, used] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { email: true } }),
    db.aiUsage.aggregate({
      where: { userId, day: jakartaDay(), feature: { not: "READ_POSTER" } },
      _sum: { count: true },
    }),
  ]);
  const limit = Number(
    isDemoEmail(user?.email) ? (process.env.AI_DAILY_LIMIT_DEMO ?? 10) : (process.env.AI_DAILY_LIMIT_PER_USER ?? 30),
  );
  return { used: used._sum.count ?? 0, limit };
}

// Check-then-call isn't atomic, so two parallel requests can overshoot by one. Fine for a daily soft cap.
export async function assertQuota(userId: string) {
  const { used, limit } = await getQuota(userId);
  if (used >= limit) throw new QuotaExceededError();
}

export async function recordUsage(userId: string, feature: AiFeature, model: string) {
  const day = jakartaDay();
  await db.aiUsage.upsert({
    where: { userId_day_feature_model: { userId, day, feature, model } },
    create: { userId, day, feature, model, count: 1 },
    update: { count: { increment: 1 } },
  });
}
