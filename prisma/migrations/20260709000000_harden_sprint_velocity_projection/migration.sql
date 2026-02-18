-- AlterTable
ALTER TABLE "sprint_velocity_snapshot"
ADD COLUMN "projectionModelVersion" TEXT NOT NULL DEFAULT '3.2.1',
ADD COLUMN "projectionDefinitionsJson" JSONB NOT NULL DEFAULT '{}'::jsonb;
