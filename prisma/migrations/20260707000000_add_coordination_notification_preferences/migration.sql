ALTER TABLE "Notification"
  ADD COLUMN "context" JSONB;

CREATE TABLE "CoordinationNotificationPreference" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "mutedCategories" JSONB NOT NULL,
  "quietHoursStart" INTEGER,
  "quietHoursEnd" INTEGER,
  "timezoneOffsetMinutes" INTEGER NOT NULL DEFAULT 0,
  "maxNudgesPerDay" INTEGER NOT NULL DEFAULT 5,
  "channels" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CoordinationNotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CoordinationNotificationPreference_projectId_userId_key"
  ON "CoordinationNotificationPreference"("projectId", "userId");

CREATE INDEX "CoordinationNotificationPreference_userId_projectId_idx"
  ON "CoordinationNotificationPreference"("userId", "projectId");

ALTER TABLE "CoordinationNotificationPreference"
  ADD CONSTRAINT "CoordinationNotificationPreference_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CoordinationNotificationPreference"
  ADD CONSTRAINT "CoordinationNotificationPreference_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
