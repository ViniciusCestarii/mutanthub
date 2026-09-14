-- CreateEnum
CREATE TYPE "GlobalRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('CONTRIBUTOR', 'REVIEWER', 'MAINTAINER');

-- CreateEnum
CREATE TYPE "MutationOperator" AS ENUM ('ARITHMETIC_OPERATOR', 'RELATIONAL_OPERATOR', 'CONDITIONAL_OPERATOR', 'LOGICAL_OPERATOR', 'CONSTANT_REPLACEMENT', 'RETURN_VALUE', 'STATEMENT_DELETION', 'FUNCTION_CALL', 'CUSTOM', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'NEEDS_INFORMATION', 'APPROVED', 'REJECTED', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "MutationStatus" AS ENUM ('UNKNOWN', 'SURVIVED', 'KILLED', 'EQUIVALENT', 'INVALID');

-- CreateEnum
CREATE TYPE "ValidationResult" AS ENUM ('SURVIVED', 'KILLED', 'COULD_NOT_REPRODUCE');

-- CreateEnum
CREATE TYPE "ObservedResult" AS ENUM ('SURVIVED', 'KILLED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "StatusKind" AS ENUM ('REVIEW', 'MUTATION');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('MUTANT_SUBMITTED', 'MUTANT_APPROVED', 'MUTANT_REJECTED', 'MUTANT_NEEDS_INFORMATION', 'MUTANT_MARKED_DUPLICATE', 'MUTANT_REPRODUCED', 'MUTANT_KILLED', 'MUTANT_MARKED_EQUIVALENT', 'MUTANT_MARKED_INVALID', 'MUTANT_STATUS_CHANGED', 'COMMENT_ADDED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "githubId" TEXT,
    "githubUsername" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "email" TEXT,
    "globalRole" "GlobalRole" NOT NULL DEFAULT 'USER',
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "githubOwner" TEXT NOT NULL,
    "githubRepository" TEXT NOT NULL,
    "githubRepositoryId" TEXT,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "defaultBranch" TEXT NOT NULL DEFAULT 'main',
    "language" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ProjectRole" NOT NULL DEFAULT 'CONTRIBUTOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectFollow" (
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectFollow_pkey" PRIMARY KEY ("projectId","userId")
);

-- CreateTable
CREATE TABLE "Revision" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "branch" TEXT,
    "commitMessage" TEXT,
    "author" TEXT,
    "commitDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mutant" (
    "id" SERIAL NOT NULL,
    "projectId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "startLine" INTEGER NOT NULL,
    "endLine" INTEGER NOT NULL,
    "originalCode" TEXT NOT NULL,
    "mutatedCode" TEXT NOT NULL,
    "gitDiff" TEXT NOT NULL,
    "mutationOperator" "MutationOperator" NOT NULL DEFAULT 'UNKNOWN',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fingerprint" TEXT NOT NULL,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "mutationStatus" "MutationStatus" NOT NULL DEFAULT 'UNKNOWN',
    "duplicateOfId" INTEGER,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mutant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "mutantId" INTEGER NOT NULL,
    "submittedById" TEXT NOT NULL,
    "buildCommand" TEXT,
    "testCommand" TEXT NOT NULL,
    "fuzzCommand" TEXT,
    "testDurationSeconds" INTEGER,
    "environmentDescription" TEXT NOT NULL,
    "operatingSystem" TEXT,
    "compiler" TEXT,
    "observedResult" "ObservedResult" NOT NULL DEFAULT 'UNKNOWN',
    "notes" TEXT,
    "stdout" TEXT,
    "stderr" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Validation" (
    "id" TEXT NOT NULL,
    "mutantId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "result" "ValidationResult" NOT NULL,
    "command" TEXT,
    "environment" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Validation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "mutantId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MutantStatusHistory" (
    "id" TEXT NOT NULL,
    "mutantId" INTEGER NOT NULL,
    "changedById" TEXT,
    "kind" "StatusKind" NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MutantStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "actorId" TEXT,
    "projectId" TEXT,
    "mutantId" INTEGER,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_githubId_key" ON "User"("githubId");

-- CreateIndex
CREATE UNIQUE INDEX "User_githubUsername_key" ON "User"("githubUsername");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_globalRole_idx" ON "User"("globalRole");

-- CreateIndex
CREATE UNIQUE INDEX "Project_githubRepositoryId_key" ON "Project"("githubRepositoryId");

-- CreateIndex
CREATE INDEX "Project_isActive_idx" ON "Project"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Project_githubOwner_githubRepository_key" ON "Project"("githubOwner", "githubRepository");

-- CreateIndex
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");

-- CreateIndex
CREATE INDEX "ProjectFollow_userId_idx" ON "ProjectFollow"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Revision_projectId_commitSha_key" ON "Revision"("projectId", "commitSha");

-- CreateIndex
CREATE INDEX "Mutant_projectId_filePath_idx" ON "Mutant"("projectId", "filePath");

-- CreateIndex
CREATE INDEX "Mutant_revisionId_filePath_startLine_idx" ON "Mutant"("revisionId", "filePath", "startLine");

-- CreateIndex
CREATE INDEX "Mutant_fingerprint_idx" ON "Mutant"("fingerprint");

-- CreateIndex
CREATE INDEX "Mutant_reviewStatus_idx" ON "Mutant"("reviewStatus");

-- CreateIndex
CREATE INDEX "Mutant_mutationStatus_idx" ON "Mutant"("mutationStatus");

-- CreateIndex
CREATE INDEX "Mutant_createdById_idx" ON "Mutant"("createdById");

-- CreateIndex
CREATE INDEX "Mutant_createdAt_idx" ON "Mutant"("createdAt");

-- CreateIndex
CREATE INDEX "Submission_mutantId_idx" ON "Submission"("mutantId");

-- CreateIndex
CREATE INDEX "Submission_submittedById_idx" ON "Submission"("submittedById");

-- CreateIndex
CREATE INDEX "Validation_mutantId_idx" ON "Validation"("mutantId");

-- CreateIndex
CREATE INDEX "Validation_userId_idx" ON "Validation"("userId");

-- CreateIndex
CREATE INDEX "Validation_createdAt_idx" ON "Validation"("createdAt");

-- CreateIndex
CREATE INDEX "Comment_mutantId_createdAt_idx" ON "Comment"("mutantId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_userId_idx" ON "Comment"("userId");

-- CreateIndex
CREATE INDEX "MutantStatusHistory_mutantId_createdAt_idx" ON "MutantStatusHistory"("mutantId", "createdAt");

-- CreateIndex
CREATE INDEX "Activity_createdAt_idx" ON "Activity"("createdAt");

-- CreateIndex
CREATE INDEX "Activity_projectId_createdAt_idx" ON "Activity"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Activity_actorId_createdAt_idx" ON "Activity"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "Activity_mutantId_idx" ON "Activity"("mutantId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFollow" ADD CONSTRAINT "ProjectFollow_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFollow" ADD CONSTRAINT "ProjectFollow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Revision" ADD CONSTRAINT "Revision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mutant" ADD CONSTRAINT "Mutant_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mutant" ADD CONSTRAINT "Mutant_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "Revision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mutant" ADD CONSTRAINT "Mutant_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mutant" ADD CONSTRAINT "Mutant_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "Mutant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_mutantId_fkey" FOREIGN KEY ("mutantId") REFERENCES "Mutant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Validation" ADD CONSTRAINT "Validation_mutantId_fkey" FOREIGN KEY ("mutantId") REFERENCES "Mutant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Validation" ADD CONSTRAINT "Validation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_mutantId_fkey" FOREIGN KEY ("mutantId") REFERENCES "Mutant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MutantStatusHistory" ADD CONSTRAINT "MutantStatusHistory_mutantId_fkey" FOREIGN KEY ("mutantId") REFERENCES "Mutant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MutantStatusHistory" ADD CONSTRAINT "MutantStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_mutantId_fkey" FOREIGN KEY ("mutantId") REFERENCES "Mutant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
