-- CreateTable
CREATE TABLE "StandupQualityDaily" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "qualityScore" INTEGER NOT NULL,
    "metricsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StandupQualityDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StandupQualityDaily_projectId_idx" ON "StandupQualityDaily"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "StandupQualityDaily_projectId_date_key" ON "StandupQualityDaily"("projectId", "date");

-- AddForeignKey
ALTER TABLE "StandupQualityDaily" ADD CONSTRAINT "StandupQualityDaily_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
