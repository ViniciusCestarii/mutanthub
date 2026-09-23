import { vi } from "vitest";
import { MemoryRateLimitStore } from "@/lib/rate-limit";

// `server-only` throws when imported outside a React Server Components bundle.
vi.mock("server-only", () => ({}));

// Keep rate-limit state per worker. With REDIS_URL set (CI), test files running in
// parallel would otherwise share one Redis store and reset each other's counters.
// The Redis store itself is covered by redis-stores.test.ts.
(globalThis as { rateLimitStore?: unknown }).rateLimitStore = new MemoryRateLimitStore();
