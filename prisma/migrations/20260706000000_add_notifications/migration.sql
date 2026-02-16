CREATE TYPE "NotificationType" AS ENUM (
  'PERSISTENT_BLOCKER',
  'MISSING_STANDUP',
  'UNANSWERED_QUESTION',
  'ACTION_OVERDUE',
  'ESCALATION'
);

CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ', 'DISMISSED');

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "triggerId" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "severity" "CoordinationSeverity" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "relatedEntityId" TEXT,
  "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX "Notification_userId_status_createdAt_idx" ON "Notification"("userId", "status", "createdAt");
CREATE INDEX "Notification_triggerId_idx" ON "Notification"("triggerId");

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_triggerId_fkey"
  FOREIGN KEY ("triggerId") REFERENCES "CoordinationTrigger"("id") ON DELETE CASCADE ON UPDATE CASCADE;
