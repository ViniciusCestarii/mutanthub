/**
 * Recomputes every mutant's fingerprint and similarity key with the current
 * `computeFingerprint` / `computeSimilarityKey`, then the `superseded` flag.
 *
 * Run with `npm run db:refingerprint` after a change to either key's material
 * (e.g. when the start line became part of the fingerprint), and once after the
 * similarity key column was added to backfill it. Idempotent: rows whose stored
 * keys are already current are left untouched, so it is safe to run on every
 * deploy.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { computeFingerprint, computeSimilarityKey } from "../src/domain/mutants/fingerprint";
import { refreshAllSuperseded } from "../src/server/repositories/superseded";

const BATCH = 500;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  let cursor: number | undefined;
  let scanned = 0;
  let updated = 0;
  for (;;) {
    const mutants = await prisma.mutant.findMany({
      select: {
        id: true,
        projectId: true,
        revisionId: true,
        filePath: true,
        startLine: true,
        originalCode: true,
        mutatedCode: true,
        fingerprint: true,
        similarityKey: true,
      },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    });
    if (mutants.length === 0) break;
    scanned += mutants.length;
    cursor = mutants[mutants.length - 1].id;

    const stale = mutants
      .map((m) => ({
        id: m.id,
        current: m,
        fingerprint: computeFingerprint(m),
        similarityKey: computeSimilarityKey(m),
      }))
      .filter(
        (m) =>
          m.current.fingerprint !== m.fingerprint || m.current.similarityKey !== m.similarityKey,
      );
    if (stale.length > 0) {
      await prisma.$transaction(
        stale.map((m) =>
          prisma.mutant.update({
            where: { id: m.id },
            data: { fingerprint: m.fingerprint, similarityKey: m.similarityKey },
          }),
        ),
      );
      updated += stale.length;
    }
  }
  console.log(`Fingerprints and similarity keys: ${scanned} mutants scanned, ${updated} updated.`);
  // Keys may have changed above; the superseded flag follows from them.
  const flagged = await refreshAllSuperseded(prisma);
  console.log(`Superseded flags: ${flagged} updated.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
