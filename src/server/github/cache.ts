import "server-only";
import { env } from "@/server/env";

/**
 * Minimal in-memory TTL cache for GitHub responses. Concurrent loads of the
 * same key share one in-flight promise so a burst of requests for the same
 * file does not fan out into several API calls.
 */
interface Entry<T> {
  value: T;
  expiresAt: number;
}

const entries = new Map<string, Entry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

export function defaultTtlMs(): number {
  return env.githubCacheTtlSeconds * 1000;
}

export async function getOrSet<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const cached = entries.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value as T;
  }

  const pending = inFlight.get(key);
  if (pending) {
    return pending as Promise<T>;
  }

  const promise = loader()
    .then((value) => {
      entries.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}

/** Drops every cached entry. Intended for tests. */
export function clear(): void {
  entries.clear();
  inFlight.clear();
}
