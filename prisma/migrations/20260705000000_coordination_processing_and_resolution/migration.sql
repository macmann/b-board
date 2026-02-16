-- Extend coordination trigger status lifecycle
ALTER TYPE "CoordinationTriggerStatus" ADD VALUE IF NOT EXISTS 'RESOLVED';

-- Add event processing tracking
ALTER TABLE "CoordinationEvent"
  ADD COLUMN "processedAt" TIMESTAMP(3);

-- Add trigger resolution timestamp
ALTER TABLE "CoordinationTrigger"
  ADD COLUMN "resolvedAt" TIMESTAMP(3);

-- New indexes for idempotent processing and entity-level resolution
CREATE INDEX "CoordinationEvent_projectId_processedAt_idx" ON "CoordinationEvent"("projectId", "processedAt");
CREATE INDEX "CoordinationTrigger_projectId_status_relatedEntityId_idx" ON "CoordinationTrigger"("projectId", "status", "relatedEntityId");
