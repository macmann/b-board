-- Research board enablement and related entities

-- Enums
CREATE TYPE "ResearchStatus" AS ENUM ('BACKLOG', 'IN_PROGRESS', 'REVIEW', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "ResearchPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "ResearchDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DEFERRED');
CREATE TYPE "ResearchObservationType" AS ENUM ('INTERVIEW', 'SURVEY', 'ANALYTICS', 'USABILITY_TEST', 'OTHER');

-- Projects can opt into the research board
ALTER TABLE "Project" ADD COLUMN "enableResearchBoard" BOOLEAN NOT NULL DEFAULT false;

-- Research items
CREATE TABLE "ResearchItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ResearchStatus" NOT NULL DEFAULT 'BACKLOG',
    "priority" "ResearchPriority" NOT NULL DEFAULT 'MEDIUM',
    "decision" "ResearchDecision" NOT NULL DEFAULT 'PENDING',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchItem_pkey" PRIMARY KEY ("id")
);

-- Observations linked to research items
CREATE TABLE "ResearchObservation" (
    "id" TEXT NOT NULL,
    "researchItemId" TEXT NOT NULL,
    "type" "ResearchObservationType" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchObservation_pkey" PRIMARY KEY ("id")
);

-- Links between research items and issues
CREATE TABLE "ResearchItemIssueLink" (
    "id" TEXT NOT NULL,
    "researchItemId" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchItemIssueLink_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "ResearchItem" ADD CONSTRAINT "ResearchItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchObservation" ADD CONSTRAINT "ResearchObservation_researchItemId_fkey" FOREIGN KEY ("researchItemId") REFERENCES "ResearchItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchItemIssueLink" ADD CONSTRAINT "ResearchItemIssueLink_researchItemId_fkey" FOREIGN KEY ("researchItemId") REFERENCES "ResearchItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchItemIssueLink" ADD CONSTRAINT "ResearchItemIssueLink_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "ResearchItem_projectId_idx" ON "ResearchItem"("projectId");
CREATE INDEX "ResearchItemIssueLink_issueId_idx" ON "ResearchItemIssueLink"("issueId");
CREATE UNIQUE INDEX "ResearchItemIssueLink_researchItemId_issueId_key" ON "ResearchItemIssueLink"("researchItemId", "issueId");
