-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'MUTANTS_IMPORTED';

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'MUTANTS_IMPORTED';

-- AlterTable
ALTER TABLE "Mutant" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "importBatchId" TEXT,
ADD COLUMN     "toolName" TEXT;

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "importedById" TEXT,
    "toolName" TEXT NOT NULL,
    "toolVersion" TEXT,
    "fileName" TEXT,
    "rowCount" INTEGER NOT NULL,
    "createdCount" INTEGER NOT NULL,
    "skippedCount" INTEGER NOT NULL,
    "errorCount" INTEGER NOT NULL,
    "report" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportBatch_projectId_createdAt_idx" ON "ImportBatch"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Mutant_importBatchId_idx" ON "Mutant"("importBatchId");

-- AddForeignKey
ALTER TABLE "Mutant" ADD CONSTRAINT "Mutant_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
