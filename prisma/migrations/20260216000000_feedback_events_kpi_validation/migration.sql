CREATE TABLE "ai_feedback" (
  "id" TEXT NOT NULL,
  "summaryVersionId" TEXT NOT NULL,
  "sectionType" TEXT NOT NULL,
  "bulletId" TEXT,
  "feedbackType" TEXT NOT NULL,
  "comment" TEXT,
  "userId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_feedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_feedback_summaryVersionId_idx" ON "ai_feedback"("summaryVersionId");
CREATE INDEX "ai_feedback_projectId_createdAt_idx" ON "ai_feedback"("projectId", "createdAt");
CREATE INDEX "ai_feedback_userId_idx" ON "ai_feedback"("userId");

ALTER TABLE "ai_feedback"
ADD CONSTRAINT "ai_feedback_summaryVersionId_fkey"
FOREIGN KEY ("summaryVersionId") REFERENCES "ai_summary_versions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_feedback"
ADD CONSTRAINT "ai_feedback_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_feedback"
ADD CONSTRAINT "ai_feedback_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "events" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "events_projectId_createdAt_idx" ON "events"("projectId", "createdAt");
CREATE INDEX "events_type_createdAt_idx" ON "events"("type", "createdAt");
CREATE INDEX "events_userId_idx" ON "events"("userId");

ALTER TABLE "events"
ADD CONSTRAINT "events_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "events"
ADD CONSTRAINT "events_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "kpi_daily" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "metricsJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kpi_daily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "kpi_daily_projectId_date_key" ON "kpi_daily"("projectId", "date");
CREATE INDEX "kpi_daily_projectId_idx" ON "kpi_daily"("projectId");

ALTER TABLE "kpi_daily"
ADD CONSTRAINT "kpi_daily_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ai_validation_flags" (
  "id" TEXT NOT NULL,
  "summaryVersionId" TEXT NOT NULL,
  "flagType" TEXT NOT NULL,
  "detailsJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_validation_flags_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_validation_flags_summaryVersionId_idx" ON "ai_validation_flags"("summaryVersionId");
CREATE INDEX "ai_validation_flags_flagType_createdAt_idx" ON "ai_validation_flags"("flagType", "createdAt");

ALTER TABLE "ai_validation_flags"
ADD CONSTRAINT "ai_validation_flags_summaryVersionId_fkey"
FOREIGN KEY ("summaryVersionId") REFERENCES "ai_summary_versions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
