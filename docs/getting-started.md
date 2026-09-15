Local development setup: requirements, environment, seed data and the npm scripts.

# Getting started

Requirements: Node 20+ (tested with Node 24), npm, Docker (or any PostgreSQL 14+).

```bash
# 1. Install dependencies (also generates the Prisma client)
npm install

# 2. Start PostgreSQL (docker compose or a plain container)
docker compose up -d
#   or
docker run -d --name mutanthub-postgres \
  -e POSTGRES_USER=mutanthub -e POSTGRES_PASSWORD=mutanthub -e POSTGRES_DB=mutanthub \
  -p 5432:5432 postgres:17-alpine

# 3. Configure the environment
cp .env.example .env
#   Set AUTH_SECRET (openssl rand -base64 32). Everything else works out of the box.

# 4. Create the schema and load the seed data
npm run db:setup          # = prisma migrate deploy + seed

# 5. Run
npm run dev
```

Open <http://localhost:3000>. Without GitHub credentials the app runs in **mock mode**:

- **Mocked login** – the sign-in page lists the eight seeded accounts (admin, maintainers,
  reviewers, contributors). Pick one or type any username to create a new account.
- **Fixture repositories** – `bitcoin/bitcoin`, `curl/curl` and `llvm/llvm-project` are served
  from bundled fixture files (original code written for this project, not upstream source), each
  with two commits so the "older revision" behaviour can be exercised.

## Seeded accounts

| User            | Roles                                                |
| --------------- | ---------------------------------------------------- |
| `bruno`         | global **admin** (can review every project)          |
| `alice`         | reviewer of bitcoin/bitcoin, maintainer of curl/curl |
| `bob`           | maintainer of bitcoin/bitcoin                        |
| `carol`         | maintainer of llvm/llvm-project                      |
| `erin`          | reviewer of curl/curl                                |
| `grace`         | reviewer of llvm/llvm-project                        |
| `dave`, `frank` | contributors                                         |

The seed creates 3 projects, 8 users, 33 mutants with submissions, ~25 validations,
~20 comments, the full status history and an activity feed covering every review and
mutation status.

## npm scripts

| Script               | Description                                                    |
| -------------------- | -------------------------------------------------------------- |
| `npm run dev`        | Start the development server.                                  |
| `npm run build`      | Production build (runs `prisma generate` first).               |
| `npm start`          | Serve the production build.                                    |
| `npm run db:migrate` | Create/apply migrations in development (`prisma migrate dev`). |
| `npm run db:deploy`  | Apply migrations without prompts (CI / production).            |
| `npm run db:seed`    | Load the development data (wipes existing domain rows).        |
| `npm run db:setup`   | `db:deploy` + `db:seed`.                                       |
| `npm run db:studio`  | Open Prisma Studio.                                            |
| `npm test`           | Unit + API tests (Vitest).                                     |
| `npm run test:e2e`   | End-to-end tests (Playwright; starts its own dev server).      |
| `npm run lint`       | ESLint.                                                        |
| `npm run typecheck`  | `tsc --noEmit`.                                                |
| `npm run format`     | Prettier.                                                      |
