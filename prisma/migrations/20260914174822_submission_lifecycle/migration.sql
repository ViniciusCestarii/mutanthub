-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'MUTANT_EDITED';
ALTER TYPE "ActivityType" ADD VALUE 'MUTANT_WITHDRAWN';
ALTER TYPE "ActivityType" ADD VALUE 'MUTANT_RESUBMITTED';

-- AlterEnum
ALTER TYPE "ReviewStatus" ADD VALUE 'WITHDRAWN';

-- AlterEnum
ALTER TYPE "StatusKind" ADD VALUE 'SUBMISSION';

-- AlterTable
ALTER TABLE "Validation" ADD COLUMN     "killingTestRef" TEXT;
