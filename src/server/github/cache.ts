import "server-only";
import { env } from "@/server/env";
import { getCacheStore } from "@/server/infra/cache-store";

/**
 * TTL cache for GitHub responses. Entries live in the configured cache store
 * (memory, or Redis when REDIS_URL is set) so several app instances share
 * them. Concurrent loads of the same key in one process share one in-flight
 * promise so a burst of requests for the same file does not fan out into
 * several API calls.
 */
const inFlight = new Map<string, Promise<unknown>>();

function store() {
  return getCacheStore("github");
}

export function defaultTtlMs(): number {
  return env.githubCacheTtlSeconds * 1000;
}

export async function getOrSet<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const cached = await store().get<T>(key);
  if (cached !== undefined) return cached;

  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = loader()
    .then(async (value) => {
      await store().set(key, value, ttlMs);
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}

/** Drops every cached entry. Intended for tests. */
export async function clear(): Promise<void> {
  inFlight.clear();
  await store().clear();
}
