/**
 * Rate-limiting primitives shared by the in-memory and Redis stores. The
 * server-side entry point (`@/server/infra/rate-limit`) picks the store; this
 * module stays free of server-only imports so it can be unit-tested directly.
 */
export interface RateLimitResult {
  ok: boolean;
  remaining: number;
}

export interface RateLimitStore {
  /** Records one hit for `key` and reports whether it is within `limit` per `windowMs`. */
  hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
  /** Clears all counters (tests, admin tooling). */
  reset(): Promise<void>;
}

export interface RateLimitOptions {
  /** Unique name of the action being limited, e.g. "submit-mutant". */
  action: string;
  /** Who is performing it (user id or IP). */
  subject: string;
  limit: number;
  windowMs: number;
}

export function rateLimitKey(opts: Pick<RateLimitOptions, "action" | "subject">): string {
  return `${opts.action}:${opts.subject}`;
}

/** Sliding-window store for a single process. */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, number[]>();
  private lastSweep = Date.now();
  private static readonly SWEEP_INTERVAL_MS = 60_000;

  async hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    this.sweep(now, windowMs);
    const timestamps = (this.buckets.get(key) ?? []).filter((t) => now - t < windowMs);
    if (timestamps.length >= limit) {
      this.buckets.set(key, timestamps);
      return { ok: false, remaining: 0 };
    }
    timestamps.push(now);
    this.buckets.set(key, timestamps);
    return { ok: true, remaining: limit - timestamps.length };
  }

  async reset(): Promise<void> {
    this.buckets.clear();
  }

  private sweep(now: number, windowMs: number): void {
    if (now - this.lastSweep < MemoryRateLimitStore.SWEEP_INTERVAL_MS) return;
    this.lastSweep = now;
    for (const [key, timestamps] of this.buckets) {
      const alive = timestamps.filter((t) => now - t < windowMs);
      if (alive.length === 0) this.buckets.delete(key);
      else this.buckets.set(key, alive);
    }
  }
}

export const RATE_LIMITS = {
  submitMutant: { limit: 20, windowMs: 60 * 60 * 1000 },
  validation: { limit: 30, windowMs: 60 * 60 * 1000 },
  comment: { limit: 60, windowMs: 60 * 60 * 1000 },
  review: { limit: 200, windowMs: 60 * 60 * 1000 },
  registerProject: { limit: 10, windowMs: 60 * 60 * 1000 },
  api: { limit: 120, windowMs: 60 * 1000 },
} as const;
