-- CreateTable
CREATE TABLE "sprint_velocity_snapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sprintId" TEXT,
    "date" DATE NOT NULL,
    "avgTasksCompletedPerDay" DOUBLE PRECISION NOT NULL,
    "avgBlockerResolutionHours" DOUBLE PRECISION,
    "avgActionResolutionHours" DOUBLE PRECISION,
    "completionRatePerDay" DOUBLE PRECISION NOT NULL,
    "remainingLinkedWork" INTEGER NOT NULL,
    "projectedCompletionDate" TIMESTAMP(3),
    "deliveryRisk" BOOLEAN NOT NULL DEFAULT false,
    "capacitySignalsJson" JSONB NOT NULL,
    "forecastConfidence" TEXT NOT NULL,
    "dataQualityScore" DOUBLE PRECISION NOT NULL,
    "velocityStabilityScore" DOUBLE PRECISION NOT NULL,
    "blockerVolatilityScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sprint_velocity_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sprint_velocity_snapshot_projectId_date_key" ON "sprint_velocity_snapshot"("projectId", "date");

-- CreateIndex
CREATE INDEX "sprint_velocity_snapshot_projectId_sprintId_date_idx" ON "sprint_velocity_snapshot"("projectId", "sprintId", "date");

-- AddForeignKey
ALTER TABLE "sprint_velocity_snapshot" ADD CONSTRAINT "sprint_velocity_snapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprint_velocity_snapshot" ADD CONSTRAINT "sprint_velocity_snapshot_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
