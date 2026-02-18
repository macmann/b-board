-- Add lifecycle events for proactive guidance telemetry
ALTER TYPE "CoordinationEventType" ADD VALUE IF NOT EXISTS 'SUGGESTION_VIEWED';
ALTER TYPE "CoordinationEventType" ADD VALUE IF NOT EXISTS 'SUGGESTION_ACCEPTED';
ALTER TYPE "CoordinationEventType" ADD VALUE IF NOT EXISTS 'SUGGESTION_DISMISSED';
ALTER TYPE "CoordinationEventType" ADD VALUE IF NOT EXISTS 'SUGGESTION_SNOOZED';

-- Add proactive guidance toggle
ALTER TABLE "ProjectAISettings"
ADD COLUMN IF NOT EXISTS "proactiveGuidanceEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Suggestion lifecycle state
DO $$ BEGIN
  CREATE TYPE "SprintSuggestionState" AS ENUM ('OPEN', 'ACCEPTED', 'DISMISSED', 'SNOOZED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "SprintGuidanceSuggestionState" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sprintId" TEXT,
  "date" DATE NOT NULL,
  "suggestionId" TEXT NOT NULL,
  "suggestionType" TEXT NOT NULL,
  "suggestionState" "SprintSuggestionState" NOT NULL DEFAULT 'OPEN',
  "dismissedUntil" DATE,
  "snoozedUntil" DATE,
  "acceptedAt" TIMESTAMP(3),
  "acceptedImpactDelta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SprintGuidanceSuggestionState_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SprintGuidanceSuggestionState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SprintGuidanceSuggestionState_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "SprintGuidanceSuggestionState_projectId_userId_date_suggestionId_key"
ON "SprintGuidanceSuggestionState"("projectId", "userId", "date", "suggestionId");

CREATE INDEX IF NOT EXISTS "SprintGuidanceSuggestionState_projectId_userId_date_idx"
ON "SprintGuidanceSuggestionState"("projectId", "userId", "date");

CREATE INDEX IF NOT EXISTS "SprintGuidanceSuggestionState_projectId_suggestionType_idx"
ON "SprintGuidanceSuggestionState"("projectId", "suggestionType");
