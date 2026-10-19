-- AlterEnum
ALTER TYPE "AiFeature" ADD VALUE 'EMAIL_UPDATE';

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "opensAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailAiNoticeAt" TIMESTAMP(3);
