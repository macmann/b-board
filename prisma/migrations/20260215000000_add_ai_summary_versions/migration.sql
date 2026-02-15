CREATE TABLE "ai_summary_versions" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "summaryId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "version" INTEGER NOT NULL,
  "model" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "inputHash" TEXT NOT NULL,
  "outputJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT NOT NULL,
  CONSTRAINT "ai_summary_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_summary_versions_summaryId_version_key" ON "ai_summary_versions"("summaryId", "version");
CREATE INDEX "ai_summary_versions_projectId_date_idx" ON "ai_summary_versions"("projectId", "date");
CREATE INDEX "ai_summary_versions_summaryId_idx" ON "ai_summary_versions"("summaryId");

ALTER TABLE "ai_summary_versions"
ADD CONSTRAINT "ai_summary_versions_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
