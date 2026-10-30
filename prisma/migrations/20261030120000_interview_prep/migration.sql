-- Interview preparation: one AiUsage feature, and the saved questions per stage on the application.
ALTER TYPE "AiFeature" ADD VALUE 'INTERVIEW_PREP';

ALTER TABLE "Application" ADD COLUMN "interviewPrep" JSONB;
