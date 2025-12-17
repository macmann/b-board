-- CreateEnum
CREATE TYPE "BuildStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'DEPLOYED', 'ROLLED_BACK', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BuildEnvironment" AS ENUM ('DEV', 'STAGING', 'UAT', 'PROD');

-- CreateTable
CREATE TABLE "Build" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "status" "BuildStatus" NOT NULL DEFAULT 'PLANNED',
    "environment" "BuildEnvironment" NOT NULL DEFAULT 'DEV',
    "plannedAt" TIMESTAMP(3),
    "deployedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Build_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildIssue" (
    "id" TEXT NOT NULL,
    "buildId" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuildIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Build_projectId_key_key" ON "Build"("projectId", "key");

-- CreateIndex
CREATE INDEX "Build_projectId_status_idx" ON "Build"("projectId", "status");

-- CreateIndex
CREATE INDEX "Build_projectId_environment_idx" ON "Build"("projectId", "environment");

-- CreateIndex
CREATE UNIQUE INDEX "BuildIssue_buildId_issueId_key" ON "BuildIssue"("buildId", "issueId");

-- CreateIndex
CREATE INDEX "BuildIssue_issueId_idx" ON "BuildIssue"("issueId");

-- AddForeignKey
ALTER TABLE "Build" ADD CONSTRAINT "Build_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Build" ADD CONSTRAINT "Build_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildIssue" ADD CONSTRAINT "BuildIssue_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "Build"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildIssue" ADD CONSTRAINT "BuildIssue_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
