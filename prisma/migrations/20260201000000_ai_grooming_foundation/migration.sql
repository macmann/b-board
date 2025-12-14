-- CreateEnum
CREATE TYPE "FeatureType" AS ENUM ('BACKLOG_GROOMING');

-- CreateEnum
CREATE TYPE "AIRunStatus" AS ENUM ('STARTED', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "AISuggestionTargetType" AS ENUM ('ISSUE');

-- CreateEnum
CREATE TYPE "AISuggestionStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'REJECTED', 'APPLIED', 'SNOOZED');

-- CreateTable
CREATE TABLE "ProjectAISettings" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "backlogGroomingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "model" TEXT,
    "temperature" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectAISettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "featureType" "FeatureType" NOT NULL,
    "status" "AIRunStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "inputSnapshot" JSONB NOT NULL,
    "outputRaw" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AISuggestion" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "featureType" "FeatureType" NOT NULL,
    "targetType" "AISuggestionTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "suggestionType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "AISuggestionStatus" NOT NULL DEFAULT 'PROPOSED',
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "snoozedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AISuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectAISettings_projectId_key" ON "ProjectAISettings"("projectId");

-- CreateIndex
CREATE INDEX "AIRun_projectId_idx" ON "AIRun"("projectId");

-- CreateIndex
CREATE INDEX "AIRun_featureType_idx" ON "AIRun"("featureType");

-- CreateIndex
CREATE INDEX "AISuggestion_projectId_idx" ON "AISuggestion"("projectId");

-- CreateIndex
CREATE INDEX "AISuggestion_targetType_targetId_idx" ON "AISuggestion"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "ProjectAISettings" ADD CONSTRAINT "ProjectAISettings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRun" ADD CONSTRAINT "AIRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRun" ADD CONSTRAINT "AIRun_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AISuggestion" ADD CONSTRAINT "AISuggestion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AISuggestion" ADD CONSTRAINT "AISuggestion_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
