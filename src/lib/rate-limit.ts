import { AppError } from "./errors";

/**
 * In-memory sliding-window rate limiter. Adequate for a single Node process;
 * swap the store for Redis when running several instances.
 */
interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();
const SWEEP_INTERVAL_MS = 60_000;
let lastSweep = Date.now();

function sweep(now: number, windowMs: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
    if (bucket.timestamps.length === 0) buckets.delete(key);
  }
}

export interface RateLimitOptions {
  /** Unique name of the action being limited, e.g. "submit-mutant". */
  action: string;
  /** Who is performing it (user id or IP). */
  subject: string;
  limit: number;
  windowMs: number;
}

export function checkRateLimit(opts: RateLimitOptions): { ok: boolean; remaining: number } {
  const now = Date.now();
  sweep(now, opts.windowMs);
  const key = `${opts.action}:${opts.subject}`;
  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < opts.windowMs);
  if (bucket.timestamps.length >= opts.limit) {
    buckets.set(key, bucket);
    return { ok: false, remaining: 0 };
  }
  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return { ok: true, remaining: opts.limit - bucket.timestamps.length };
}

export function enforceRateLimit(opts: RateLimitOptions): void {
  const result = checkRateLimit(opts);
  if (!result.ok) {
    throw new AppError(
      "RATE_LIMITED",
      "Too many requests. Please slow down and try again shortly.",
    );
  }
}

/** Test helper. */
export function resetRateLimits(): void {
  buckets.clear();
}

export const RATE_LIMITS = {
  submitMutant: { limit: 20, windowMs: 60 * 60 * 1000 },
  validation: { limit: 30, windowMs: 60 * 60 * 1000 },
  comment: { limit: 60, windowMs: 60 * 60 * 1000 },
  review: { limit: 200, windowMs: 60 * 60 * 1000 },
  registerProject: { limit: 10, windowMs: 60 * 60 * 1000 },
  api: { limit: 120, windowMs: 60 * 1000 },
} as const;
