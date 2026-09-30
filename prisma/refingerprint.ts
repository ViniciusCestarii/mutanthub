/**
 * Recomputes every mutant's fingerprint with the current `computeFingerprint`,
 * then the `superseded` flag.
 *
 * Run with `npm run db:refingerprint` after a change to the fingerprint
 * material (e.g. when the start line became part of it). Idempotent: rows whose
 * stored fingerprint is already current are left untouched, so it is safe to
 * run on every deploy.
 *
 * The similarity key is not touched here: it depends on the lines around the
 * mutant, which only the app can read from GitHub. Older keys are recomputed by
 * the similarity backfill job (`POST /api/jobs/similarity`).
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { computeFingerprint } from "../src/domain/mutants/fingerprint";
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
      },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    });
    if (mutants.length === 0) break;
    scanned += mutants.length;
    cursor = mutants[mutants.length - 1].id;

    const stale = mutants
      .map((m) => ({ id: m.id, current: m.fingerprint, fingerprint: computeFingerprint(m) }))
      .filter((m) => m.current !== m.fingerprint);
    if (stale.length > 0) {
      await prisma.$transaction(
        stale.map((m) =>
          prisma.mutant.update({ where: { id: m.id }, data: { fingerprint: m.fingerprint } }),
        ),
      );
      updated += stale.length;
    }
  }
  console.log(`Fingerprints: ${scanned} mutants scanned, ${updated} updated.`);
  // Self-heal: the superseded flag follows from the similarity keys and results.
  const flagged = await refreshAllSuperseded(prisma);
  console.log(`Superseded flags: ${flagged} updated.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
