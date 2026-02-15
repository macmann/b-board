ALTER TABLE "ai_feedback"
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "ai_feedback" SET "bulletId" = '' WHERE "bulletId" IS NULL;
ALTER TABLE "ai_feedback"
ALTER COLUMN "bulletId" SET DEFAULT '',
ALTER COLUMN "bulletId" SET NOT NULL;

CREATE UNIQUE INDEX "ai_feedback_summaryVersionId_userId_sectionType_bulletId_key"
ON "ai_feedback"("summaryVersionId", "userId", "sectionType", "bulletId");

ALTER TABLE "events"
ADD COLUMN "summaryVersionId" TEXT,
ADD COLUMN "clientEventId" TEXT;

CREATE UNIQUE INDEX "events_clientEventId_key" ON "events"("clientEventId");
CREATE INDEX "events_projectId_type_createdAt_idx" ON "events"("projectId", "type", "createdAt");
CREATE INDEX "events_summaryVersionId_createdAt_idx" ON "events"("summaryVersionId", "createdAt");

ALTER TABLE "events"
ADD CONSTRAINT "events_summaryVersionId_fkey"
FOREIGN KEY ("summaryVersionId") REFERENCES "ai_summary_versions"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
