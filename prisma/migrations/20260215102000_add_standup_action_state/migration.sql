-- CreateEnum
CREATE TYPE "StandupActionStateType" AS ENUM ('OPEN', 'DONE', 'SNOOZED', 'DISMISSED');

-- CreateTable
CREATE TABLE "StandupActionState" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "actionId" TEXT NOT NULL,
    "state" "StandupActionStateType" NOT NULL DEFAULT 'OPEN',
    "snoozeUntil" DATE,
    "summaryVersion" INTEGER,
    "clientEventId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StandupActionState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StandupActionState_projectId_userId_date_actionId_key" ON "StandupActionState"("projectId", "userId", "date", "actionId");

-- CreateIndex
CREATE INDEX "StandupActionState_projectId_date_userId_idx" ON "StandupActionState"("projectId", "date", "userId");

-- CreateIndex
CREATE INDEX "StandupActionState_actionId_idx" ON "StandupActionState"("actionId");

-- AddForeignKey
ALTER TABLE "StandupActionState" ADD CONSTRAINT "StandupActionState_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandupActionState" ADD CONSTRAINT "StandupActionState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
