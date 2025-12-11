-- CreateTable
CREATE TABLE "StandupEntryResearchLink" (
    "id" TEXT NOT NULL,
    "standupEntryId" TEXT NOT NULL,
    "researchItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StandupEntryResearchLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StandupEntryResearchLink_standupEntryId_researchItemId_key" ON "StandupEntryResearchLink"("standupEntryId", "researchItemId");

-- CreateIndex
CREATE INDEX "StandupEntryResearchLink_researchItemId_idx" ON "StandupEntryResearchLink"("researchItemId");

-- AddForeignKey
ALTER TABLE "StandupEntryResearchLink" ADD CONSTRAINT "StandupEntryResearchLink_standupEntryId_fkey" FOREIGN KEY ("standupEntryId") REFERENCES "DailyStandupEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandupEntryResearchLink" ADD CONSTRAINT "StandupEntryResearchLink_researchItemId_fkey" FOREIGN KEY ("researchItemId") REFERENCES "ResearchItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
