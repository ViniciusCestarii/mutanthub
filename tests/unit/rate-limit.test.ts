import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, enforceRateLimit, resetRateLimits } from "@/lib/rate-limit";

describe("rate limiter", () => {
  beforeEach(() => resetRateLimits());

  it("allows up to the limit and then blocks", () => {
    const opts = { action: "t", subject: "u", limit: 2, windowMs: 60_000 };
    expect(checkRateLimit(opts).ok).toBe(true);
    expect(checkRateLimit(opts).ok).toBe(true);
    expect(checkRateLimit(opts).ok).toBe(false);
    expect(() => enforceRateLimit(opts)).toThrowError(/Too many requests/);
  });

  it("isolates subjects and actions", () => {
    const a = { action: "t", subject: "a", limit: 1, windowMs: 60_000 };
    expect(checkRateLimit(a).ok).toBe(true);
    expect(checkRateLimit({ ...a, subject: "b" }).ok).toBe(true);
    expect(checkRateLimit({ ...a, action: "other" }).ok).toBe(true);
    expect(checkRateLimit(a).ok).toBe(false);
  });
});
