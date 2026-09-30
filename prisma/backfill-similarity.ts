/**
 * Recomputes similarity keys written by an older scheme (code pair only) with
 * the lines around each mutant, read from GitHub at the mutant's commit.
 *
 * Run with `npm run db:similarity`; the production `migrate` service runs it
 * after `db:refingerprint`. Idempotent: it only touches rows on an older key
 * version, so it is a no-op once they are done. A GitHub rate limit stops it
 * early without failing (the rest is picked up by the next run or by
 * `POST /api/jobs/similarity`).
 *
 * It reuses the app's GitHub client and repositories, hence the react-server
 * condition in the npm script.
 */
import "dotenv/config";
import { backfillSimilarityKeys } from "@/server/services/similarity";
import { prisma } from "@/server/db/prisma";

// A one-off run needs no shared cache, and an open Redis connection would keep
// the process (and so the compose `migrate` service) from exiting.
delete process.env.REDIS_URL;

async function main() {
  let updated = 0;
  let unreadable = 0;
  for (;;) {
    const run = await backfillSimilarityKeys();
    updated += run.updated;
    unreadable += run.unreadable;
    if (run.rateLimited) {
      console.warn(
        `Similarity keys: GitHub rate limit reached, ${run.remaining} mutants left for a later run.`,
      );
      break;
    }
    if (run.remaining === 0 || run.updated === 0) break;
  }
  console.log(
    `Similarity keys: ${updated} recomputed with context (${unreadable} with an unreadable file).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    // Other handles (e.g. GitHub App token refresh timers) must not hold the deploy.
    process.exit();
  });
