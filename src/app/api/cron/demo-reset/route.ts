import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { demoLoginEnabled } from "@/lib/demo";
import { resetDemoAccount } from "@/lib/demo-reset";
import { deleteObject, putPdf } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(request.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

// Vercel Cron, daily 23:00 UTC = 06:00 WIB (vercel.json): rebuilds the demo account so its dates stay current.
// Only where the demo login is offered; touches nothing but the demo account.
export async function GET(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  if (!demoLoginEnabled()) return Response.json({ skipped: "demo login disabled" });
  const started = Date.now();
  const result = await resetDemoAccount({ db, putPdf, deleteObject });
  console.info("demo-reset: done", { ...result, ms: Date.now() - started });
  return Response.json(result);
}
