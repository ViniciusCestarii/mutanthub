-- CreateEnum
CREATE TYPE "PullRequestState" AS ENUM ('OPEN', 'CLOSED', 'MERGED');

-- AlterTable
ALTER TABLE "Mutant" ADD COLUMN     "pullRequestId" TEXT;

-- AlterTable
ALTER TABLE "Revision" ADD COLUMN     "pullRequestId" TEXT;

-- CreateTable
CREATE TABLE "PullRequest" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "authorLogin" TEXT,
    "state" "PullRequestState" NOT NULL DEFAULT 'OPEN',
    "baseRef" TEXT NOT NULL,
    "baseSha" TEXT NOT NULL,
    "headRef" TEXT NOT NULL,
    "headSha" TEXT NOT NULL,
    "htmlUrl" TEXT NOT NULL,
    "changedRanges" JSONB NOT NULL,
    "changedFiles" INTEGER NOT NULL DEFAULT 0,
    "additions" INTEGER NOT NULL DEFAULT 0,
    "deletions" INTEGER NOT NULL DEFAULT 0,
    "checkRunId" TEXT,
    "checkRunAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PullRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PullRequest_projectId_state_updatedAt_idx" ON "PullRequest"("projectId", "state", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PullRequest_projectId_number_key" ON "PullRequest"("projectId", "number");

-- CreateIndex
CREATE INDEX "Mutant_pullRequestId_idx" ON "Mutant"("pullRequestId");

-- CreateIndex
CREATE INDEX "Revision_pullRequestId_idx" ON "Revision"("pullRequestId");

-- AddForeignKey
ALTER TABLE "Revision" ADD CONSTRAINT "Revision_pullRequestId_fkey" FOREIGN KEY ("pullRequestId") REFERENCES "PullRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mutant" ADD CONSTRAINT "Mutant_pullRequestId_fkey" FOREIGN KEY ("pullRequestId") REFERENCES "PullRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PullRequest" ADD CONSTRAINT "PullRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
