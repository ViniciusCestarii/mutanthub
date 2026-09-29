-- AlterTable
ALTER TABLE "Mutant" ADD COLUMN     "superseded" BOOLEAN NOT NULL DEFAULT false;

-- Backfill (same rule as src/server/repositories/superseded.ts; db:refingerprint also recomputes it)
UPDATE "Mutant" AS m
SET "superseded" = TRUE
WHERE m."similarityKey" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "Mutant" n
    JOIN "Revision" rn ON rn.id = n."revisionId"
    JOIN "Revision" rm ON rm.id = m."revisionId"
    WHERE n."similarityKey" = m."similarityKey"
      AND n.id <> m.id
      AND n."reviewStatus" NOT IN ('REJECTED', 'DUPLICATE', 'WITHDRAWN')
      AND CASE
        WHEN m."mutationStatus" = 'EQUIVALENT' THEN
          n."mutationStatus" = 'EQUIVALENT'
          AND COALESCE(rn."commitDate", rn."createdAt") > COALESCE(rm."commitDate", rm."createdAt")
        ELSE
          n."mutationStatus" = 'EQUIVALENT'
          OR (
            n."mutationStatus" IN ('SURVIVED', 'KILLED')
            AND COALESCE(rn."commitDate", rn."createdAt") > COALESCE(rm."commitDate", rm."createdAt")
          )
      END
  );
