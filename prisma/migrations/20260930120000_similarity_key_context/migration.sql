-- AlterTable: existing keys are version 1 (code pair only) until the similarity backfill job
-- (POST /api/jobs/similarity) recomputes them with surrounding context.
ALTER TABLE "Mutant" ADD COLUMN     "similarityKeyVersion" INTEGER NOT NULL DEFAULT 1;
