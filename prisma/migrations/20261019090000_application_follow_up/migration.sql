-- Follow-up tracking: next follow-up date, last follow-up, and the reminder marker (all optional).
ALTER TABLE "Application" ADD COLUMN "nextActionAt" TIMESTAMP(3),
ADD COLUMN "lastFollowUpAt" TIMESTAMP(3),
ADD COLUMN "followUpRemindedAt" TIMESTAMP(3);

CREATE INDEX "Application_nextActionAt_idx" ON "Application"("nextActionAt");
