-- Reading a poster image gets its own AiUsage feature, so it is recorded but not counted against the daily quota.
ALTER TYPE "AiFeature" ADD VALUE 'READ_POSTER';
