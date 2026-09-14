import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRateLimitStore, rateLimitKey } from "@/lib/rate-limit";
import { checkRateLimit, enforceRateLimit, resetRateLimits } from "@/server/infra/rate-limit";

describe("MemoryRateLimitStore", () => {
  it("allows up to the limit and then blocks", async () => {
    const store = new MemoryRateLimitStore();
    expect(await store.hit("k", 2, 60_000)).toEqual({ ok: true, remaining: 1 });
    expect(await store.hit("k", 2, 60_000)).toEqual({ ok: true, remaining: 0 });
    expect(await store.hit("k", 2, 60_000)).toEqual({ ok: false, remaining: 0 });
  });

  it("forgets hits after the window", async () => {
    const store = new MemoryRateLimitStore();
    expect((await store.hit("k", 1, 10)).ok).toBe(true);
    expect((await store.hit("k", 1, 10)).ok).toBe(false);
    await new Promise((r) => setTimeout(r, 15));
    expect((await store.hit("k", 1, 10)).ok).toBe(true);
  });

  it("builds keys from action and subject", () => {
    expect(rateLimitKey({ action: "a", subject: "s" })).toBe("a:s");
  });
});

describe("rate limiter (memory store, no REDIS_URL)", () => {
  beforeEach(() => resetRateLimits());

  it("enforces limits per subject and action", async () => {
    const a = { action: "t", subject: "a", limit: 1, windowMs: 60_000 };
    expect((await checkRateLimit(a)).ok).toBe(true);
    expect((await checkRateLimit({ ...a, subject: "b" })).ok).toBe(true);
    expect((await checkRateLimit({ ...a, action: "other" })).ok).toBe(true);
    expect((await checkRateLimit(a)).ok).toBe(false);
    await expect(enforceRateLimit(a)).rejects.toThrowError(/Too many requests/);
  });
});
