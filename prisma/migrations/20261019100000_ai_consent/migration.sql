-- AI consent (UU PDP) and usage tracking for the two new AI features. Additive only.
ALTER TYPE "AiFeature" ADD VALUE 'CV_TWEAKS';
ALTER TYPE "AiFeature" ADD VALUE 'FOLLOW_UP';

ALTER TABLE "User" ADD COLUMN "aiConsentAt" TIMESTAMP(3);
