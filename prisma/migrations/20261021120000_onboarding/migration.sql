-- New-user wizard (/mulai). Existing users count as onboarded, so only sign-ups from now on see it.
ALTER TABLE "User" ADD COLUMN "onboardedAt" TIMESTAMP(3);
UPDATE "User" SET "onboardedAt" = "createdAt";
