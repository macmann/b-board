-- CreateTable
CREATE TABLE "StandupEntryClarification" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StandupEntryClarification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StandupEntryClarification_entryId_questionId_key" ON "StandupEntryClarification"("entryId", "questionId");

-- CreateIndex
CREATE INDEX "StandupEntryClarification_projectId_createdAt_idx" ON "StandupEntryClarification"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "StandupEntryClarification_questionId_idx" ON "StandupEntryClarification"("questionId");

-- AddForeignKey
ALTER TABLE "StandupEntryClarification" ADD CONSTRAINT "StandupEntryClarification_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandupEntryClarification" ADD CONSTRAINT "StandupEntryClarification_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "DailyStandupEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandupEntryClarification" ADD CONSTRAINT "StandupEntryClarification_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
