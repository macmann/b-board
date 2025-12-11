-- AlterTable
ALTER TABLE "StandupSummary"
  DROP COLUMN IF EXISTS "highlights",
  DROP COLUMN IF EXISTS "updatedAt";

ALTER TABLE "StandupSummary"
  ALTER COLUMN "date" TYPE DATE USING "date"::date,
  ALTER COLUMN "createdAt" TYPE DATE USING "createdAt"::date,
  ALTER COLUMN "createdAt" SET DEFAULT CURRENT_DATE,
  ALTER COLUMN "summary" TYPE TEXT;
