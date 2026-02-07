-- CreateTable
CREATE TABLE "FacilitatorNote" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "teammateId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "FacilitatorNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FacilitatorNote_projectId_date_idx" ON "FacilitatorNote"("projectId", "date");

-- CreateIndex
CREATE INDEX "FacilitatorNote_projectId_teammateId_idx" ON "FacilitatorNote"("projectId", "teammateId");

-- CreateIndex
CREATE INDEX "FacilitatorNote_authorId_idx" ON "FacilitatorNote"("authorId");

-- AddForeignKey
ALTER TABLE "FacilitatorNote" ADD CONSTRAINT "FacilitatorNote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilitatorNote" ADD CONSTRAINT "FacilitatorNote_teammateId_fkey" FOREIGN KEY ("teammateId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilitatorNote" ADD CONSTRAINT "FacilitatorNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
