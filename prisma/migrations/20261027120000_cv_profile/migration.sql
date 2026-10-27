-- Search words taken from a CV for the "Cari lowongan" links (additive, nullable), and their AI feature.
ALTER TYPE "AiFeature" ADD VALUE 'CV_PROFILE';
ALTER TABLE "Resume" ADD COLUMN "profile" JSONB;
