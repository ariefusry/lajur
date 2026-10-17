import "server-only";
import { db } from "@/lib/db";
import type { EligibilityProfile } from "@/lib/eligibility/check";

export async function getEligibilityProfile(userId: string): Promise<EligibilityProfile> {
  const u = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { gpa: true, birthDate: true, major: true, degree: true },
  });
  return { gpa: u.gpa === null ? null : Number(u.gpa), birthDate: u.birthDate, major: u.major, degree: u.degree };
}
