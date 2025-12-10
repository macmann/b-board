-- Add optional key column for issues
ALTER TABLE "Issue" ADD COLUMN "key" TEXT;

-- Ensure keys are unique when provided
CREATE UNIQUE INDEX "Issue_key_key" ON "Issue"("key");
