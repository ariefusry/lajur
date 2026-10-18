"use server";

import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { DEMO_EMAIL, DEMO_NONIT_EMAIL, demoLoginEnabled } from "@/lib/demo";

const DEMO_SESSION_MS = 24 * 60 * 60 * 1000;

/**
 * "Masuk sebagai demo": opens an Auth.js database session for the seeded demo account (no Google needed).
 * Only when DEMO_LOGIN_ENABLED=true; in production the account is also view-only (DEMO_READ_ONLY=true).
 */
export async function signInAsDemo() {
  await openDemoSession(DEMO_EMAIL);
}

/** Same, for the second persona (S1 Manajemen) so non-IT visitors see data that fits them. */
export async function signInAsNonItDemo() {
  await openDemoSession(DEMO_NONIT_EMAIL);
}

async function openDemoSession(email: string) {
  if (!demoLoginEnabled()) redirect("/login");
  const user = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) redirect("/login?error=demo");

  const sessionToken = randomUUID();
  const expires = new Date(Date.now() + DEMO_SESSION_MS);
  await db.$transaction([
    db.session.deleteMany({ where: { userId: user.id, expires: { lt: new Date() } } }), // tidy old demo sessions
    db.session.create({ data: { sessionToken, userId: user.id, expires } }),
  ]);

  // Same cookie Auth.js reads for database sessions; "__Secure-" prefix on HTTPS (Vercel), plain on local http.
  const secure = (await headers()).get("x-forwarded-proto") === "https";
  (await cookies()).set(secure ? "__Secure-authjs.session-token" : "authjs.session-token", sessionToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    expires,
  });
  redirect("/dashboard");
}
