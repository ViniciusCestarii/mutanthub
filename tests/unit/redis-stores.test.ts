import { afterAll, describe, expect, it } from "vitest";
import { RedisCacheStore } from "@/server/infra/cache-store";
import { RedisRateLimitStore } from "@/server/infra/rate-limit";
import { getRedis } from "@/server/infra/redis";

/**
 * Exercises the Redis-backed stores against a real server. Skipped unless
 * REDIS_URL is set (CI provides a Redis service; locally run e.g.
 * `docker run -d -p 6379:6379 redis:7-alpine` and export REDIS_URL).
 */
const redisUrl = process.env.REDIS_URL;
const prefix = `test:${process.pid}:${Date.now()}:`;

describe.skipIf(!redisUrl)("Redis stores", () => {
  afterAll(async () => {
    const client = await getRedis();
    if (!client) return;
    for await (const keys of client.scanIterator({ MATCH: `${prefix}*`, COUNT: 200 })) {
      if (keys.length) await client.del(keys);
    }
    await client.quit();
  });

  it("connects", async () => {
    const client = await getRedis();
    expect(client).not.toBeNull();
    expect(await client!.ping()).toBe("PONG");
  });

  it("cache store round-trips values with dates and honours TTL", async () => {
    const store = new RedisCacheStore(`${prefix}cache:`);
    const value = { sha: "abc", date: new Date("2026-09-01T10:00:00Z"), entries: [{ n: 1 }] };
    await store.set("commit", value, 5_000);
    const restored = await store.get<typeof value>("commit");
    expect(restored?.sha).toBe("abc");
    expect(restored?.date).toBeInstanceOf(Date);
    expect(restored?.date.toISOString()).toBe("2026-09-01T10:00:00.000Z");

    await store.set("short", 1, 50);
    await new Promise((r) => setTimeout(r, 120));
    expect(await store.get("short")).toBeUndefined();

    await store.delete("commit");
    expect(await store.get("commit")).toBeUndefined();
  });

  it("rate-limit store counts hits within a window and resets", async () => {
    const store = new RedisRateLimitStore(`${prefix}rl:`);
    expect(await store.hit("u", 2, 60_000)).toEqual({ ok: true, remaining: 1 });
    expect(await store.hit("u", 2, 60_000)).toEqual({ ok: true, remaining: 0 });
    expect(await store.hit("u", 2, 60_000)).toEqual({ ok: false, remaining: 0 });
    expect((await store.hit("other", 2, 60_000)).ok).toBe(true);
    await store.reset();
    expect((await store.hit("u", 2, 60_000)).ok).toBe(true);
  });
});
