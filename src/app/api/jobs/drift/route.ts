import { NextResponse } from "next/server";
import { rejectUnlessCron } from "@/server/api/cron-auth";
import { driftService } from "@/server/services/drift-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/jobs/drift — runs the drift check for every active project.
 * Protected by `Authorization: Bearer <CRON_SECRET>`; disabled when unset.
 */
export async function POST(request: Request) {
  const rejected = rejectUnlessCron(request);
  if (rejected) return rejected;
  const started = Date.now();
  const results = await driftService.checkAll();
  return NextResponse.json({ ok: true, durationMs: Date.now() - started, results });
}
