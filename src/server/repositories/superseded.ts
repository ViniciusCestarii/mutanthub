/**
 * Maintains `Mutant.superseded`: true when a result for the same mutation
 * (equal similarity key) exists at a newer commit, so the mutant is no longer
 * the current word on it. It backs the "latest result only" list filter.
 *
 * A sibling counts when it was not rejected, withdrawn or marked duplicate and
 * has a conclusive result (SURVIVED, KILLED or EQUIVALENT); UNKNOWN or INVALID
 * runs never hide an earlier result. "Newer" compares the commit date, falling
 * back to when the revision was first recorded. An EQUIVALENT sibling
 * supersedes any non-equivalent result, whatever its commit, while an
 * EQUIVALENT mutant only yields to a newer EQUIVALENT one, so every mutation
 * keeps exactly one latest result visible (more on a tie).
 *
 * Kept free of "server-only" so `prisma/refingerprint.ts` can recompute every
 * row on deploy.
 */
import { Prisma, type PrismaClient } from "../../generated/prisma/client";

type Db = Pick<PrismaClient, "$executeRaw"> | Prisma.TransactionClient;

const isSuperseded = Prisma.sql`EXISTS (
  SELECT 1
  FROM "Mutant" n
  JOIN "Revision" rn ON rn.id = n."revisionId"
  JOIN "Revision" rm ON rm.id = m2."revisionId"
  WHERE n."similarityKey" = m2."similarityKey"
    AND n.id <> m2.id
    AND n."reviewStatus" NOT IN ('REJECTED', 'DUPLICATE', 'WITHDRAWN')
    AND CASE
      WHEN m2."mutationStatus" = 'EQUIVALENT' THEN
        n."mutationStatus" = 'EQUIVALENT'
        AND COALESCE(rn."commitDate", rn."createdAt") > COALESCE(rm."commitDate", rm."createdAt")
      ELSE
        n."mutationStatus" = 'EQUIVALENT'
        OR (
          n."mutationStatus" IN ('SURVIVED', 'KILLED')
          AND COALESCE(rn."commitDate", rn."createdAt") > COALESCE(rm."commitDate", rm."createdAt")
        )
    END
)`;

function refresh(db: Db, scope: Prisma.Sql) {
  return db.$executeRaw`
    UPDATE "Mutant" AS m
    SET "superseded" = s.value
    FROM (
      SELECT m2.id, (m2."similarityKey" IS NOT NULL AND ${isSuperseded}) AS value
      FROM "Mutant" m2
      WHERE ${scope}
    ) AS s
    WHERE m.id = s.id AND m."superseded" <> s.value`;
}

/** Recomputes the flag for every mutant sharing one of these similarity keys. */
export function refreshSuperseded(db: Db, keys: Array<string | null | undefined>) {
  const distinct = [...new Set(keys.filter((k): k is string => !!k))];
  if (distinct.length === 0) return Promise.resolve(0);
  return refresh(db, Prisma.sql`m2."similarityKey" = ANY(${distinct}::text[])`);
}

/** After a revision's commit date changed: its mutants' groups may reorder. */
export function refreshSupersededForRevision(db: Db, revisionId: string) {
  return refresh(
    db,
    Prisma.sql`m2."similarityKey" IN (
      SELECT "similarityKey" FROM "Mutant" WHERE "revisionId" = ${revisionId}
    )`,
  );
}

/** Recomputes every row (deploy-time self-heal). Returns the number of rows changed. */
export function refreshAllSuperseded(db: Db) {
  return refresh(db, Prisma.sql`TRUE`);
}
