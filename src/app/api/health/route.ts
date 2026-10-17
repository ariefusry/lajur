import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Public health check: no personal data, only liveness + a row count.
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    const users = await db.user.count();
    return Response.json({ ok: true, db: "up", users });
  } catch (error) {
    console.error("health: db check failed", error);
    return Response.json({ ok: false, db: "down" }, { status: 503 });
  }
}
