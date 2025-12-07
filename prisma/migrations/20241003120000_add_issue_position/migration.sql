-- Add position column to support per-column ordering
ALTER TABLE "Issue" ADD COLUMN "position" DOUBLE PRECISION NOT NULL DEFAULT 0;
