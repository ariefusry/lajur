-- The profile form stored birth dates as Jakarta midnight (17:00 UTC the day before), which the date column
-- truncated to one day early. The form was the only writer apart from the demo reset (already UTC midnight).
UPDATE "User" SET "birthDate" = "birthDate" + 1 WHERE "birthDate" IS NOT NULL AND "email" <> 'demo@lamarin.local';
