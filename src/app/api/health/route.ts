import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { redisHealthy } from "@/server/infra/redis";
import { env } from "@/server/env";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — liveness/readiness probe for containers and load balancers.
 * Returns 200 when the database answers; Redis is reported but optional.
 */
export async function GET() {
  const startedAt = Date.now();
  let database: "ok" | "error" = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "error";
  }
  const redis = await redisHealthy();
  const status = database === "ok" ? 200 : 503;
  return NextResponse.json(
    {
      status: status === 200 ? "ok" : "degraded",
      checks: {
        database,
        redis,
        github: env.resolvedGithubMode,
        githubAuth:
          env.resolvedGithubMode === "mock"
            ? "mock"
            : env.githubAppConfigured
              ? "app"
              : env.githubToken
                ? "token"
                : "anonymous",
      },
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
