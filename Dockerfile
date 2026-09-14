# syntax=docker/dockerfile:1.7
#
# MutantHub production image.
#
#   builder  – full toolchain: used for `next build`, migrations and seeding
#   runner   – minimal standalone server (no Prisma CLI, no dev dependencies)
#
# Build:   docker build -t mutanthub .
# Run:     see docker-compose.prod.yml (app + postgres + redis + migrations)

ARG NODE_VERSION=24

# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# postinstall runs `prisma generate`; no database connection is needed for it.
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

COPY . .
# The build never connects to the database; the URL only has to be well-formed.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" AUTH_SECRET="build" npm run build

# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates curl \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs --home /app nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Fixture repositories so GITHUB_MODE=mock works inside the container (demo / staging).
COPY --from=builder --chown=nextjs:nodejs /app/src/server/github/fixtures ./src/server/github/fixtures

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
