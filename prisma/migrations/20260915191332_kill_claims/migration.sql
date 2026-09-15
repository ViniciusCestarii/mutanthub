-- CreateEnum
CREATE TYPE "KillClaimKind" AS ENUM ('PULL_REQUEST', 'COMMIT', 'TEST_PATH');

-- CreateEnum
CREATE TYPE "KillClaimStatus" AS ENUM ('CLAIMED', 'VERIFIED', 'REFUTED', 'STALE');

-- CreateEnum
CREATE TYPE "KillClaimApplies" AS ENUM ('UNKNOWN', 'APPLIES', 'MOVED', 'NOT_FOUND');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'KILL_CLAIMED';
ALTER TYPE "ActivityType" ADD VALUE 'KILL_VERIFIED';
ALTER TYPE "ActivityType" ADD VALUE 'KILL_REFUTED';

-- AlterTable
ALTER TABLE "Validation" ADD COLUMN     "commitSha" TEXT,
ADD COLUMN     "killClaimId" TEXT;

-- CreateTable
CREATE TABLE "KillClaim" (
    "id" TEXT NOT NULL,
    "mutantId" INTEGER NOT NULL,
    "claimedById" TEXT NOT NULL,
    "kind" "KillClaimKind" NOT NULL,
    "reference" TEXT NOT NULL,
    "note" TEXT,
    "status" "KillClaimStatus" NOT NULL DEFAULT 'CLAIMED',
    "pullRequestId" TEXT,
    "prState" "PullRequestState",
    "prTouchesTests" BOOLEAN,
    "verifyCommitSha" TEXT,
    "applies" "KillClaimApplies" NOT NULL DEFAULT 'UNKNOWN',
    "appliesLine" INTEGER,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KillClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KillClaim_mutantId_createdAt_idx" ON "KillClaim"("mutantId", "createdAt");

-- CreateIndex
CREATE INDEX "KillClaim_pullRequestId_idx" ON "KillClaim"("pullRequestId");

-- CreateIndex
CREATE INDEX "KillClaim_status_idx" ON "KillClaim"("status");

-- AddForeignKey
ALTER TABLE "Validation" ADD CONSTRAINT "Validation_killClaimId_fkey" FOREIGN KEY ("killClaimId") REFERENCES "KillClaim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KillClaim" ADD CONSTRAINT "KillClaim_mutantId_fkey" FOREIGN KEY ("mutantId") REFERENCES "Mutant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KillClaim" ADD CONSTRAINT "KillClaim_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KillClaim" ADD CONSTRAINT "KillClaim_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KillClaim" ADD CONSTRAINT "KillClaim_pullRequestId_fkey" FOREIGN KEY ("pullRequestId") REFERENCES "PullRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
