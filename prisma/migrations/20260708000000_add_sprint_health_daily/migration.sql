-- CreateTable
CREATE TABLE "SprintHealthDaily" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "healthScore" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "confidenceLevel" TEXT NOT NULL,
    "scoreBreakdown" JSONB NOT NULL,
    "riskDrivers" JSONB NOT NULL,
    "staleWorkCount" INTEGER NOT NULL DEFAULT 0,
    "missingStandups" INTEGER NOT NULL DEFAULT 0,
    "persistentBlockers" INTEGER NOT NULL DEFAULT 0,
    "unresolvedActions" INTEGER NOT NULL DEFAULT 0,
    "qualityScore" INTEGER,
    "probabilities" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SprintHealthDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SprintHealthDaily_projectId_date_idx" ON "SprintHealthDaily"("projectId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SprintHealthDaily_projectId_date_key" ON "SprintHealthDaily"("projectId", "date");

-- AddForeignKey
ALTER TABLE "SprintHealthDaily" ADD CONSTRAINT "SprintHealthDaily_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
