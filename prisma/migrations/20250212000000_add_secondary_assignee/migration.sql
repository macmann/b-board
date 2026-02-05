-- AlterEnum
ALTER TYPE "IssueHistoryField" ADD VALUE IF NOT EXISTS 'SECONDARY_ASSIGNEE';

-- AlterTable
ALTER TABLE "Issue" ADD COLUMN "secondaryAssigneeId" TEXT;

-- CreateIndex
CREATE INDEX "Issue_secondaryAssigneeId_idx" ON "Issue"("secondaryAssigneeId");

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_secondaryAssigneeId_fkey" FOREIGN KEY ("secondaryAssigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
