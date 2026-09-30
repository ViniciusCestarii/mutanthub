import { NextResponse } from "next/server";
import { rejectUnlessCron } from "@/server/api/cron-auth";
import { backfillSimilarityKeys } from "@/server/services/similarity";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/jobs/similarity — recomputes up to 5000 older similarity keys with
 * their surrounding lines (the deploy-time `db:similarity` does the same).
 * Protected by `Authorization: Bearer <CRON_SECRET>`; a no-op once done.
 */
export async function POST(request: Request) {
  const rejected = rejectUnlessCron(request);
  if (rejected) return rejected;
  const started = Date.now();
  const result = await backfillSimilarityKeys();
  return NextResponse.json({ ok: true, durationMs: Date.now() - started, ...result });
}
