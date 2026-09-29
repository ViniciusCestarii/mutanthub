-- AlterTable
ALTER TABLE "Mutant" ADD COLUMN     "similarityKey" TEXT;

-- CreateIndex
CREATE INDEX "Mutant_similarityKey_idx" ON "Mutant"("similarityKey");
