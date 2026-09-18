Running MutantHub on a server with Docker: configuration, first start, upgrades, backups and operation.

# Deploying with Docker

The repository ships a multi-stage `Dockerfile` and `docker-compose.prod.yml`. The compose stack
runs PostgreSQL 17, Redis 7, a one-off `migrate` job and the app; it is what a single-server
deployment should use. The examples use `docker compose`; the standalone `docker-compose`
binary works the same way.

## 1. Configure

```bash
cp .env.example .env
```

Minimum for production:

| Variable                               | Value                                                              |
| -------------------------------------- | ------------------------------------------------------------------ |
| `AUTH_SECRET`                          | `openssl rand -base64 32`                                          |
| `AUTH_URL`                             | Public URL, e.g. `https://mutanthub.example.com`                   |
| `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` | OAuth credentials of your GitHub App (or OAuth App)                |
| `GITHUB_MODE`                          | `live`                                                             |
| `GITHUB_APP_*` or `GITHUB_TOKEN`       | Repository read access (see "GitHub App")                          |
| `ADMIN_GITHUB_USERNAMES`               | Your GitHub login, so the first sign-in makes you an administrator |
| `POSTGRES_PASSWORD`                    | A real password (defaults to `mutanthub`)                          |

Leave `AUTH_MOCK` unset. `DATABASE_URL` and `REDIS_URL` are set by the compose file. To reach
the site from the internet add `SITE_ADDRESS=<your domain>` (see the next section).

## 2. First start

On a VPS with a domain (an `A` record already pointing at the host), the `web` profile starts
Caddy in front of the app: it obtains and renews a Let's Encrypt certificate, redirects HTTP to
HTTPS, compresses responses and forwards the `Host` and `X-Forwarded-*` headers the app checks.

```bash
curl -fsSL https://get.docker.com | sh                      # once, on a fresh Ubuntu host
git clone https://github.com/brunoerg/mutanthub.git && cd mutanthub
cp .env.example .env                                        # then edit it (section 1)
docker compose -f docker-compose.prod.yml --profile web up -d --build
docker compose -f docker-compose.prod.yml logs migrate     # "All migrations have been successfully applied"
curl -s https://$SITE_ADDRESS/api/health                    # database ok, redis ok, github live
```

Point your GitHub App (or OAuth App) at `https://<domain>/api/auth/callback/github` and the
webhook at `https://<domain>/api/github/webhook`, and set `AUTH_URL=https://<domain>`. Open
ports 80 and 443 in the host firewall; nothing else needs to be reachable.

Without the profile the app only listens on `127.0.0.1:3000`, for your own reverse proxy or a
tunnel. Set `APP_BIND=0.0.0.0` to expose port 3000 directly (plain HTTP, not recommended on the
internet).

```bash
docker compose -f docker-compose.prod.yml up -d --build
curl -s http://localhost:3000/api/health
```

`migrate` runs `prisma migrate deploy` and exits; the app only starts after it succeeds. Sign in
with GitHub, then register your first repository from **Projects**. Do not seed: production
starts empty.

## 3. Upgrade

```bash
git pull
docker compose -f docker-compose.prod.yml --profile web up -d --build   # drop --profile web if you run your own proxy
docker compose -f docker-compose.prod.yml logs migrate
```

Rebuilding recreates the `migrate` container, so pending migrations are applied before the new
app version starts. To apply migrations by hand at any time:

```bash
docker compose -f docker-compose.prod.yml run --rm migrate
```

Migrations are written to be backward compatible with the previous release, so rolling the app
back to the previous image does not require rolling the schema back.

## 4. Back up and restore

The database is the scientific record (mutants, history, audit trail). Back it up before every
upgrade and nightly:

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U mutanthub -d mutanthub -Fc > mutanthub-$(date +%F).dump

# restore into an empty database
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_restore -U mutanthub -d mutanthub --clean --if-exists < mutanthub-2026-09-15.dump
```

## 5. Operate

- Logs: `docker compose -f docker-compose.prod.yml logs -f app`
- Health: `GET /api/health` returns `200` when the database answers and reports Redis and the
  GitHub auth mode (`app`, `token` or `anonymous`).
- Scheduled drift check: set `CRON_SECRET` in `.env` and start the optional `jobs` service
  (`docker compose -f docker-compose.prod.yml --profile jobs up -d`), which calls
  `POST /api/jobs/drift` with the bearer token once a day (`JOBS_INTERVAL_SECONDS`). Any external
  scheduler works too: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/jobs/drift`.
  Maintainers can also run it from the project settings page.
- Reverse proxy: the `web` profile's Caddy does this for you. With your own proxy (nginx,
  Traefik), terminate TLS and forward `X-Forwarded-For`, which the rate limiter uses, and
  `X-Forwarded-Host` or the original `Host`, which the upload endpoints compare with the
  browser's `Origin` (the configured `AUTH_URL` is accepted too). The app sets its own security
  headers. Certificates live in the `caddy_data` volume; include it in backups if you want to
  avoid re-issuing them after a restore.
- Scaling: `docker compose -f docker-compose.prod.yml up -d --scale app=3` behind your proxy; the
  rate limiter and GitHub cache are shared through Redis.
- Port: the app listens on `3000`, bound to `127.0.0.1` unless `APP_BIND` says otherwise;
  override the host port with `APP_PORT`.

## Demo data (staging only)

`docker compose -f docker-compose.prod.yml --profile seed run --rm seed` loads the development
fixtures (fake users, mutants and commits). **It deletes every existing project, mutant,
validation, comment and notification first.** Use it only on a throwaway or staging database,
together with `GITHUB_MODE=mock`; never against production.

## Without the compose plugin

Build the two images (`docker build --target builder -t mutanthub-tools .` for migrations and
`docker build --target runner -t mutanthub .` for the app), start Postgres and Redis, run
`npx prisma migrate deploy` from the tools image, then run the app image with the same
environment variables the compose file passes.
