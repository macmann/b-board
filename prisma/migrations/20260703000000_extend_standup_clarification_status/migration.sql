-- CreateEnum
CREATE TYPE "StandupClarificationStatus" AS ENUM ('ANSWERED', 'DISMISSED');

-- AlterTable
ALTER TABLE "StandupEntryClarification"
  ADD COLUMN "dismissedUntil" DATE,
  ADD COLUMN "status" "StandupClarificationStatus" NOT NULL DEFAULT 'ANSWERED',
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "answer" DROP NOT NULL;
