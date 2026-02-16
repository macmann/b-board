-- Create enums
CREATE TYPE "CoordinationEventType" AS ENUM (
  'SUMMARY_VIEWED',
  'EVIDENCE_CLICKED',
  'FEEDBACK_SUBMITTED',
  'DIGEST_COPIED',
  'ACTION_INTERACTION',
  'QUESTION_EVENT',
  'BLOCKER_PERSISTED',
  'MISSING_STANDUP_DETECTED',
  'STALE_WORK_DETECTED',
  'LOW_CONFIDENCE_DETECTED',
  'ACTION_OVERDUE',
  'QUESTION_UNANSWERED',
  'SNOOZE_EXPIRED'
);

CREATE TYPE "CoordinationSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

CREATE TYPE "CoordinationTriggerStatus" AS ENUM ('PENDING', 'SENT', 'DISMISSED');

-- Create table: CoordinationEvent
CREATE TABLE "CoordinationEvent" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "eventType" "CoordinationEventType" NOT NULL,
  "targetUserId" TEXT,
  "relatedEntityId" TEXT,
  "severity" "CoordinationSeverity",
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CoordinationEvent_pkey" PRIMARY KEY ("id")
);

-- Create table: CoordinationTrigger
CREATE TABLE "CoordinationTrigger" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "relatedEntityId" TEXT,
  "severity" "CoordinationSeverity" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "CoordinationTriggerStatus" NOT NULL DEFAULT 'PENDING',
  "escalationLevel" INTEGER NOT NULL,
  "dedupKey" TEXT NOT NULL,

  CONSTRAINT "CoordinationTrigger_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "CoordinationEvent_projectId_occurredAt_idx" ON "CoordinationEvent"("projectId", "occurredAt");
CREATE INDEX "CoordinationEvent_projectId_eventType_occurredAt_idx" ON "CoordinationEvent"("projectId", "eventType", "occurredAt");
CREATE INDEX "CoordinationEvent_targetUserId_idx" ON "CoordinationEvent"("targetUserId");
CREATE INDEX "CoordinationTrigger_projectId_createdAt_idx" ON "CoordinationTrigger"("projectId", "createdAt");
CREATE INDEX "CoordinationTrigger_projectId_status_idx" ON "CoordinationTrigger"("projectId", "status");
CREATE INDEX "CoordinationTrigger_ruleId_targetUserId_relatedEntityId_createdAt_idx" ON "CoordinationTrigger"("ruleId", "targetUserId", "relatedEntityId", "createdAt");
CREATE INDEX "CoordinationTrigger_dedupKey_createdAt_idx" ON "CoordinationTrigger"("dedupKey", "createdAt");

-- Add foreign keys
ALTER TABLE "CoordinationEvent"
  ADD CONSTRAINT "CoordinationEvent_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CoordinationTrigger"
  ADD CONSTRAINT "CoordinationTrigger_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
