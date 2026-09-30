import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/server/env";

/**
 * Guards scheduled job endpoints: `Authorization: Bearer <CRON_SECRET>`.
 * Returns the error response to send, or null when the caller may proceed.
 */
export function rejectUnlessCron(request: Request): NextResponse | null {
  const secret = env.cronSecret;
  if (!secret)
    return NextResponse.json({ error: "Scheduled jobs are not configured" }, { status: 503 });
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || !safeEqual(token, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
