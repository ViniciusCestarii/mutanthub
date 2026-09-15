import "server-only";
import { NextResponse } from "next/server";
import { isAppError } from "@/lib/errors";
import { checkRateLimit, RATE_LIMITS } from "@/server/infra/rate-limit";

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export function baseUrl(request: Request): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export function apiError(status: number, message: string, details?: unknown) {
  return NextResponse.json({ error: { status, message, details } }, { status });
}

/** Shared wrapper: rate limiting + error translation for public JSON endpoints. */
export async function handleApi(request: Request, fn: () => Promise<Response>): Promise<Response> {
  const limit = await checkRateLimit({
    ...RATE_LIMITS.api,
    action: "api",
    subject: clientIp(request),
  });
  if (!limit.ok) return apiError(429, "Rate limit exceeded. Try again in a minute.");
  try {
    const response = await fn();
    response.headers.set("X-RateLimit-Remaining", String(limit.remaining));
    return response;
  } catch (e) {
    if (isAppError(e)) return apiError(e.status, e.message, e.details);
    console.error("API error", e);
    return apiError(500, "Internal server error");
  }
}
