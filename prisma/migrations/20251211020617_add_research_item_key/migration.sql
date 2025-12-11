-- Add nullable key column first to allow backfilling existing data
ALTER TABLE "ResearchItem" ADD COLUMN "key" TEXT;

-- Populate existing research items with deterministic keys per project
UPDATE "ResearchItem"
SET "key" = CONCAT('DR-', seq.row_num)
FROM (
    SELECT "id", ROW_NUMBER() OVER (PARTITION BY "projectId" ORDER BY "createdAt", "id") AS row_num
    FROM "ResearchItem"
) AS seq
WHERE "ResearchItem"."id" = seq."id";

-- Enforce required and unique constraints
ALTER TABLE "ResearchItem" ALTER COLUMN "key" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ResearchItem_projectId_key_key" ON "ResearchItem"("projectId", "key");

