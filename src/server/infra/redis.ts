import "server-only";
import { createClient, type RedisClientType } from "redis";
import { env } from "@/server/env";

/**
 * Optional Redis connection. When `REDIS_URL` is unset the app keeps its
 * in-memory stores, which is correct for a single process (development, CI).
 * With several app instances, point every instance at the same Redis so rate
 * limits and the GitHub cache are shared.
 *
 * Connection errors are logged once and the callers fall back to memory for
 * that operation, so a Redis outage degrades sharing rather than availability.
 */
const globalForRedis = globalThis as unknown as {
  redisClient?: RedisClientType;
  redisConnecting?: Promise<RedisClientType | null>;
  redisErrorLogged?: boolean;
};

export function redisConfigured(): boolean {
  return Boolean(env.redisUrl);
}

export async function getRedis(): Promise<RedisClientType | null> {
  if (!env.redisUrl) return null;
  if (globalForRedis.redisClient?.isReady) return globalForRedis.redisClient;
  if (globalForRedis.redisConnecting) return globalForRedis.redisConnecting;

  globalForRedis.redisConnecting = (async () => {
    try {
      const client: RedisClientType = createClient({
        url: env.redisUrl,
        socket: {
          connectTimeout: 3000,
          reconnectStrategy: (retries) => Math.min(retries * 200, 5000),
        },
      });
      client.on("error", (error: Error) => {
        if (!globalForRedis.redisErrorLogged) {
          globalForRedis.redisErrorLogged = true;
          console.error(
            "[redis] connection error, falling back to in-memory stores:",
            error.message,
          );
        }
      });
      client.on("ready", () => {
        globalForRedis.redisErrorLogged = false;
      });
      await client.connect();
      globalForRedis.redisClient = client;
      return client;
    } catch (error) {
      if (!globalForRedis.redisErrorLogged) {
        globalForRedis.redisErrorLogged = true;
        console.error(
          "[redis] could not connect, using in-memory stores:",
          (error as Error).message,
        );
      }
      return null;
    } finally {
      globalForRedis.redisConnecting = undefined;
    }
  })();
  return globalForRedis.redisConnecting;
}

/** Pings Redis; used by the health endpoint. */
export async function redisHealthy(): Promise<"ok" | "error" | "not-configured"> {
  if (!env.redisUrl) return "not-configured";
  try {
    const client = await getRedis();
    if (!client) return "error";
    return (await client.ping()) === "PONG" ? "ok" : "error";
  } catch {
    return "error";
  }
}
