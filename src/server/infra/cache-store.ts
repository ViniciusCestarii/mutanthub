import "server-only";
import { getRedis, redisConfigured } from "./redis";

/**
 * Key/value cache with per-entry TTL. Two implementations: in-memory (single
 * process) and Redis (shared between instances). Values are JSON-serialised
 * for Redis; `Date` instances survive the round trip through a small tag.
 */
export interface CacheStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

interface MemoryEntry {
  value: unknown;
  expiresAt: number;
}

export class MemoryCacheStore implements CacheStore {
  private readonly entries = new Map<string, MemoryEntry>();

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  async clear(): Promise<void> {
    this.entries.clear();
  }
}

const DATE_TAG = "__mutanthub_date__";

export function serializeValue(value: unknown): string {
  return JSON.stringify(value, function replacer(this: Record<string, unknown>, key: string) {
    const raw = this[key];
    return raw instanceof Date ? { [DATE_TAG]: raw.toISOString() } : raw;
  });
}

export function deserializeValue<T>(text: string): T {
  return JSON.parse(text, (_key, value) =>
    value && typeof value === "object" && DATE_TAG in value
      ? new Date((value as Record<string, string>)[DATE_TAG])
      : value,
  ) as T;
}

/** Redis-backed store; every operation falls back to the memory store when Redis is unavailable. */
export class RedisCacheStore implements CacheStore {
  constructor(
    private readonly prefix: string,
    private readonly fallback: CacheStore = new MemoryCacheStore(),
  ) {}

  async get<T>(key: string): Promise<T | undefined> {
    const client = await getRedis();
    if (!client) return this.fallback.get<T>(key);
    try {
      const text = await client.get(this.prefix + key);
      return text == null ? undefined : deserializeValue<T>(text);
    } catch {
      return this.fallback.get<T>(key);
    }
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    const client = await getRedis();
    if (!client) return this.fallback.set(key, value, ttlMs);
    try {
      await client.set(this.prefix + key, serializeValue(value), { PX: Math.max(1, ttlMs) });
    } catch {
      await this.fallback.set(key, value, ttlMs);
    }
  }

  async delete(key: string): Promise<void> {
    const client = await getRedis();
    await this.fallback.delete(key);
    if (!client) return;
    try {
      await client.del(this.prefix + key);
    } catch {
      /* fallback already cleared */
    }
  }

  async clear(): Promise<void> {
    await this.fallback.clear();
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

const globalForStores = globalThis as unknown as { cacheStores?: Map<string, CacheStore> };

/** Returns a named store (one per subsystem), Redis-backed when configured. */
export function getCacheStore(name: string): CacheStore {
  const stores = (globalForStores.cacheStores ??= new Map());
  const existing = stores.get(name);
  if (existing) return existing;
  const store = redisConfigured()
    ? new RedisCacheStore(`mutanthub:${name}:`)
    : new MemoryCacheStore();
  stores.set(name, store);
  return store;
}
