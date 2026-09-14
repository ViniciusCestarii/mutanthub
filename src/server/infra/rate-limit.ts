import "server-only";
import { AppError } from "@/lib/errors";
import {
  MemoryRateLimitStore,
  rateLimitKey,
  RATE_LIMITS,
  type RateLimitOptions,
  type RateLimitResult,
  type RateLimitStore,
} from "@/lib/rate-limit";
import { getRedis, redisConfigured } from "./redis";

export { RATE_LIMITS };
export type { RateLimitOptions, RateLimitResult };

/**
 * Fixed-window counter in Redis (INCR + PEXPIRE), shared by every instance.
 * Falls back to the in-memory store when Redis is unreachable so a cache
 * outage never blocks users.
 */
export class RedisRateLimitStore implements RateLimitStore {
  constructor(
    private readonly prefix: string,
    private readonly fallback: RateLimitStore = new MemoryRateLimitStore(),
  ) {}

  async hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const client = await getRedis();
    if (!client) return this.fallback.hit(key, limit, windowMs);
    const window = Math.floor(Date.now() / windowMs);
    const redisKey = `${this.prefix}${key}:${window}`;
    try {
      const [count] = await client.multi().incr(redisKey).pExpire(redisKey, windowMs, "NX").exec();
      const hits = Number(count);
      return hits > limit ? { ok: false, remaining: 0 } : { ok: true, remaining: limit - hits };
    } catch {
      return this.fallback.hit(key, limit, windowMs);
    }
  }

  async reset(): Promise<void> {
    await this.fallback.reset();
    const client = await getRedis();
    if (!client) return;
    try {
      for await (const keys of client.scanIterator({ MATCH: `${this.prefix}*`, COUNT: 200 })) {
        if (keys.length) await client.del(keys);
      }
    } catch {
      /* best effort */
    }
  }
}

const globalForRateLimit = globalThis as unknown as { rateLimitStore?: RateLimitStore };

export function getRateLimitStore(): RateLimitStore {
  if (!globalForRateLimit.rateLimitStore) {
    globalForRateLimit.rateLimitStore = redisConfigured()
      ? new RedisRateLimitStore("mutanthub:ratelimit:")
      : new MemoryRateLimitStore();
  }
  return globalForRateLimit.rateLimitStore;
}

export function checkRateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  return getRateLimitStore().hit(rateLimitKey(opts), opts.limit, opts.windowMs);
}

export async function enforceRateLimit(opts: RateLimitOptions): Promise<void> {
  const result = await checkRateLimit(opts);
  if (!result.ok) {
    throw new AppError(
      "RATE_LIMITED",
      "Too many requests. Please slow down and try again shortly.",
    );
  }
}

/** Test helper. */
export function resetRateLimits(): Promise<void> {
  return getRateLimitStore().reset();
}
