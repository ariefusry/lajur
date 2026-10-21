"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Leaves the required part of the /mulai wizard: from here the app is open, and the last (optional) step
 * "first application" ends on the board like any new application.
 */
export async function finishOnboarding() {
  const user = await requireUser();
  await db.user.updateMany({ where: { id: user.id, onboardedAt: null }, data: { onboardedAt: new Date() } });
  redirect("/mulai?step=5");
}
