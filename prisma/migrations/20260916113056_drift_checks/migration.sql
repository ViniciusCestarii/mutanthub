-- CreateEnum
CREATE TYPE "DriftStatus" AS ENUM ('UNCHECKED', 'APPLIES', 'MOVED', 'GONE');

-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'MUTANT_DRIFTED';

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'DRIFT_CHECKED';

-- AlterTable
ALTER TABLE "Mutant" ADD COLUMN     "driftCheckedAt" TIMESTAMP(3),
ADD COLUMN     "driftCommitSha" TEXT,
ADD COLUMN     "driftLine" INTEGER,
ADD COLUMN     "driftStatus" "DriftStatus" NOT NULL DEFAULT 'UNCHECKED';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "driftCheckedAt" TIMESTAMP(3),
ADD COLUMN     "driftCommitSha" TEXT;

-- CreateIndex
CREATE INDEX "Mutant_projectId_driftStatus_idx" ON "Mutant"("projectId", "driftStatus");
