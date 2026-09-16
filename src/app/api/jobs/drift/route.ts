import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/server/env";
import { driftService } from "@/server/services/drift-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/jobs/drift — runs the drift check for every active project.
 * Protected by `Authorization: Bearer <CRON_SECRET>`; disabled when unset.
 */
export async function POST(request: Request) {
  const secret = env.cronSecret;
  if (!secret)
    return NextResponse.json({ error: "Scheduled jobs are not configured" }, { status: 503 });
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || !safeEqual(token, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const started = Date.now();
  const results = await driftService.checkAll();
  return NextResponse.json({ ok: true, durationMs: Date.now() - started, results });
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
