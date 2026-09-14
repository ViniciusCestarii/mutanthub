# MutantHub

[![CI](https://github.com/brunoerg/mutanthub/actions/workflows/ci.yml/badge.svg)](https://github.com/brunoerg/mutanthub/actions/workflows/ci.yml)

A collaborative platform for cataloguing, reviewing, reproducing and investigating software
mutants that survive the test suites of open-source projects.

MutantHub feels like a mix of GitHub, code review and a small read-only IDE, focused on one
workflow:

1. browse the source of a registered repository at an exact commit;
2. select a line and **suggest a mutant** (title, operator, original/mutated code, git diff);
3. describe **how it was tested** (build/test/fuzz commands, environment, observed result);
4. reviewers **approve / reject / request information / mark duplicates**;
5. other contributors **reproduce** the result (survived / killed / could not reproduce);
6. the community discusses equivalence, reproduction issues and killing tests;
7. every status change is kept as **history**, so the data can become a public dataset.

> MutantHub never executes user-provided commands or patches. Commands are stored and displayed
> as text only. A surviving mutant is not automatically a weakness of the test suite: it may be
> equivalent, invalid, environment-dependent or simply not reproduced yet.

---

## Stack

| Concern    | Choice                                                     |
| ---------- | ---------------------------------------------------------- |
| Framework  | Next.js 16 (App Router, Server Components, Server Actions) |
| Language   | TypeScript (strict), React 19                              |
| UI         | Tailwind CSS v4, shadcn/ui, Lucide icons, Monaco Editor    |
| Database   | PostgreSQL 17, Prisma 7 (`@prisma/adapter-pg`)             |
| Auth       | Auth.js (next-auth v5) with GitHub OAuth, JWT sessions     |
| GitHub     | REST API v3 through a small client with an in-memory cache |
| Validation | Zod                                                        |
| Tests      | Vitest (unit, API), Playwright (end-to-end)                |
| Tooling    | ESLint, Prettier                                           |

## Quick start

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

### Seeded accounts

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

## Configuration

All variables are documented in [`.env.example`](.env.example).

| Variable                                | Purpose                                                                                                                                       |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                          | PostgreSQL connection string.                                                                                                                 |
| `AUTH_SECRET`                           | Secret used to sign session JWTs.                                                                                                             |
| `AUTH_URL`                              | Public URL of the app (OAuth callbacks).                                                                                                      |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | GitHub OAuth app credentials. Callback URL: `<AUTH_URL>/api/auth/callback/github`. Scope requested: `read:user user:email` (no write access). |
| `AUTH_MOCK`                             | `true` forces the mocked login even when OAuth is configured (development / tests only).                                                      |
| `GITHUB_TOKEN`                          | Token used for repository browsing (public read access is enough). Raises the API rate limit to 5,000 req/h.                                  |
| `GITHUB_MODE`                           | `auto` (live when a token is present, otherwise fixtures), `live`, or `mock`.                                                                 |
| `GITHUB_CACHE_TTL`                      | Seconds to cache GitHub responses in memory (immutable commits are cached for 24 h).                                                          |

### Using real GitHub data

1. Create an OAuth app at GitHub → Settings → Developer settings → OAuth Apps, with the callback
   URL above, and copy the id/secret into `.env`.
2. Create a personal access token with public repository read access and set `GITHUB_TOKEN`.
3. Restart the dev server. Sign in with GitHub, open **Projects → Register repository** and add
   any public repository (`owner/name`). The person who registers a project becomes its
   maintainer and can review submissions.

The seeded fixture projects will show "Not found on GitHub" for their fake commits when running
in live mode; register real repositories instead, or keep `GITHUB_MODE=mock` for the seed data.

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

## Architecture

The project is a single Next.js application, but layered so that the backend could be split out
later. React components never call Prisma or GitHub directly.

```
src/
├── app/                      Routes (App Router). Pages are thin: they call services and render.
│   ├── api/                  Public REST API (/api/mutants, /api/mutants/[id], /api/docs) and
│   │                         internal JSON endpoints (file tree). Auth.js handler.
│   ├── projects/[owner]/[repo]/code/[[...path]]   IDE-like code browser
│   ├── mutants/, review/, dashboard/, users/, search/, settings/, signin/
├── components/
│   ├── ui/                   shadcn/ui primitives
│   ├── code/                 Monaco viewer/diff wrappers, static diff & command blocks
│   ├── code-browser/         file tree, mutants panel, workspace state
│   ├── mutants/              suggest-mutant drawer, badges, tables, filters
│   ├── mutant-detail/, review/, projects/, activity/, layout/, shared/
├── domain/                   Pure, framework-free logic (unit-tested)
│   ├── mutants/fingerprint.ts        duplicate detection hash
│   ├── mutants/diff.ts               unified diff helpers (generate / stats), never applied
│   ├── mutants/status.ts             review & mutation transitions, labels, activity mapping
│   ├── mutants/validation-summary.ts "Survived — confirmed by N contributors" logic
│   └── auth/permissions.ts           role checks (global + per-project)
├── lib/                      Zod schemas & limits, errors, rate limiting, markdown sanitizing,
│                             route builders, formatting helpers
├── server/                   Server-only code
│   ├── auth/                 Auth.js config (GitHub + mock credentials), session helpers
│   ├── db/prisma.ts          Prisma client singleton
│   ├── github/               GitHubClient interface, live REST client, fixture mock, TTL cache
│   ├── repositories/         All Prisma queries (users, projects, mutants, interactions, stats)
│   ├── services/             Use cases + authorization (project, code browser, mutant, review,
│   │                         interaction, dashboard, search, user)
│   ├── actions/              Server Actions: thin adapters from forms to services
│   └── api/                  REST serializers and HTTP helpers
└── generated/prisma/         Generated Prisma client (git-ignored)
prisma/                       schema.prisma, migrations, seed.ts
tests/                        unit/, api/ (Vitest) and e2e/ (Playwright)
```

Request flow: **page / action → service (authorization, validation, rules) → repository (Prisma)**
and **service → GitHubClient (live or mock) → cache**.

### Domain model

- **Project** – a GitHub repository (`owner/repo`, default branch, language). Members hold a
  per-project role: `CONTRIBUTOR`, `REVIEWER`, `MAINTAINER`. Users have a global role
  (`USER`, `ADMIN`).
- **Revision** – an exact commit (`projectId + commitSha` is unique). **Every mutant points to a
  Revision**; a line number is never used as identity.
- **Mutant** – file, line range, original/mutated code, git diff, operator, title, description,
  `fingerprint`, and two independent states:
  - `reviewStatus`: `PENDING`, `NEEDS_INFORMATION`, `APPROVED`, `REJECTED`, `DUPLICATE`,
    `WITHDRAWN` (moderation; only the submitter withdraws or resubmits);
  - `mutationStatus`: `UNKNOWN`, `SURVIVED`, `KILLED`, `EQUIVALENT`, `INVALID` (experimental
    outcome). A mutant can be `APPROVED` + `SURVIVED` today and become `KILLED` later without
    losing its history.
- **Submission** – how the submitter tested the mutant (build/test/fuzz commands, duration,
  environment, OS, compiler, observed result, notes, logs). Text only.
- **Validation** – a reproduction attempt by another user: `SURVIVED`, `KILLED`,
  `COULD_NOT_REPRODUCE`, plus command/environment/notes and an optional `killingTestRef`.
- **Comment** – Markdown discussion (sanitized on render).
- **MutantStatusHistory** – append-only log of every review/mutation transition and every
  submission edit (who, from, to, when, comment).
- **Activity** – feed events (submitted, approved, rejected, reproduced, killed, equivalent,
  comment added, ...).

### Duplicate detection

`fingerprint = sha256(project, revision, file path, normalized original code, normalized mutated
code)`; normalization removes indentation, trailing whitespace, CRLF and blank lines. Submissions
with the same fingerprint are **exact** duplicates; the same code pair at a different revision is
reported as **similar**. The drawer shows "Possible duplicate" while typing and after submission;
nothing is blocked automatically. Reviewers can mark a mutant as `DUPLICATE` of another.

### Commit drift

The code browser always shows which commit is being viewed. Mutant pages state
"Mutant created against commit abc1234" and, when the default branch has moved on, warn that the
mutant refers to an older revision. Automatic rebasing is intentionally left for a future
milestone; historical references are preserved as-is.

### Security

- Commands, patches and logs are stored and displayed as text. Nothing is executed.
- Markdown is rendered with `marked` and sanitized with `sanitize-html` (no scripts, no event
  handlers, safe link attributes).
- Every mutation goes through a service that checks the session and the role
  (`src/domain/auth/permissions.ts`). Pages redirect or render "permission denied" states,
  but the server-side checks are authoritative.
- Server Actions include Next.js' built-in origin checks (CSRF protection); Auth.js protects its
  own routes. Public API routes are read-only.
- Zod validates all inputs with size limits (`src/lib/validation/limits.ts`).
- An in-memory sliding-window rate limiter protects submissions, validations, comments, reviews,
  project registration and the public API (per user or per IP). Replace the store with Redis when
  running multiple instances.
- File paths are validated against traversal; the mock client refuses paths outside its fixtures.

## Public API

Read-only endpoints for dataset consumers (rate limit: 120 requests / minute / IP):

- `GET /api/mutants` – paginated list. Filters: `project=owner/repo`, `language`, `operator`,
  `reviewStatus`, `mutationStatus`, `contributor`, `commit`, `file`, `q`, `page`, `pageSize`.
- `GET /api/mutants/:id` – full record with diff, test evidence, validations and history.
- `GET /api/docs` – OpenAPI 3.1 description of the above.

```json
{
  "id": 182,
  "repository": "bitcoin/bitcoin",
  "commit": "9b2e4d6f8a0c1e3b5d7f9a1c3e5b7d9f1a3c5e7b",
  "file": "src/script/interpreter.cpp",
  "startLine": 60,
  "endLine": 60,
  "reviewStatus": "APPROVED",
  "mutationStatus": "SURVIVED",
  "reproductions": 4,
  "reproductionSummary": {
    "survived": 4,
    "killed": 0,
    "couldNotReproduce": 0,
    "consensus": "SURVIVED"
  }
}
```

The serializers in `src/server/api/serializers.ts` define the stable dataset shape; CSV/JSON
bulk exports can be added on top of them.

## Testing

```bash
npm test              # Vitest: domain logic, fingerprinting, permissions, schemas, markdown,
                      # rate limiting, GitHub mock client, REST API handlers
npm run test:e2e      # Playwright: full workflow against a seeded database
```

The end-to-end suite starts `next dev` on port 3300 with `AUTH_MOCK=true` and
`GITHUB_MODE=mock`, and expects the database to be migrated and seeded (`npm run db:setup`).
It covers: mocked login → open project → navigate to a file → select a line → submit a mutant →
reviewer opens the queue and approves → another user records a reproduction → a user comments →
the history shows every step. A second suite covers the submission lifecycle (edit, needs
information, resubmit, withdraw, killing-test reference), and a third covers project settings
(members, roles, last-maintainer protection, deactivation).

## Continuous integration

`.github/workflows/ci.yml` runs on every push to `main` and on pull requests:

- **checks**: `npm ci`, lint, type-check, Prettier check, unit + API tests, production build.
- **e2e**: the same install, then Playwright (Chromium) against a PostgreSQL 17 service
  container with migrations and seed applied, using mocked login and fixture repositories.
  The HTML report and traces are uploaded as an artifact when a test fails.

Both jobs need no secrets: `DATABASE_URL` points at the service container and `AUTH_SECRET` is a
throwaway value set in the workflow.

## Routes

| Route                                     | Description                                      |
| ----------------------------------------- | ------------------------------------------------ |
| `/`                                       | Landing page                                     |
| `/dashboard`                              | Personal dashboard (signed in)                   |
| `/projects`                               | Projects + register repository                   |
| `/projects/[owner]/[repo]`                | Project overview and statistics                  |
| `/projects/[owner]/[repo]/code/[...path]` | Code browser (`?ref=` selects a commit/branch)   |
| `/projects/[owner]/[repo]/mutants`        | Mutants of a project                             |
| `/mutants`                                | All mutants with filters                         |
| `/mutants/[id]`                           | Mutant detail, evidence, validations, discussion |
| `/review`                                 | Review queue (reviewers, maintainers, admins)    |
| `/users/[username]`                       | Public profile                                   |
| `/search`                                 | Global search (press `/`)                        |
| `/settings`                               | Account settings                                 |
| `/signin`                                 | Sign-in (GitHub or mocked)                       |

## Status

### Implemented (MVP)

- GitHub OAuth sign-in (read-only scopes) with a mocked login for development and tests.
- Project registration from GitHub metadata; per-project roles (contributor, reviewer, maintainer)
  and a global admin role; follow/unfollow.
- Maintainer settings page: add members by GitHub username (placeholder accounts are claimed on
  first sign-in), change roles, remove members (the last maintainer is protected), refresh
  metadata from GitHub, deactivate/reactivate the project.
- Repository browsing at any commit or branch: lazy file tree, read-only Monaco viewer with mutant
  indicators in the gutter, line selection via clicks or `#L123` links, commit selector, drift
  notice for older revisions, mobile drawers.
- Suggest-mutant drawer with pre-filled location, operator catalogue, diff generation, Monaco diff
  preview, test-evidence fields, live "possible duplicate" detection and inline validation errors.
- Mutant detail page: side-by-side and unified diff (copy patch), evidence, reproduction summary,
  validation timeline, Markdown discussion, full status history, duplicate and drift notices.
- Review queue with filters, inbox/detail layout, approve / reject / needs information / mark
  duplicate, and classification of the scientific outcome (survived, killed, equivalent, invalid).
- Submission lifecycle for contributors: edit while pending or awaiting information (previous
  evidence kept as revisions), resubmit after "needs information" or withdrawal, withdraw a
  pending submission (`WITHDRAWN` review status). Every step lands in the history.
- Reproductions (validations) with an optional killing-test reference (test path, PR or commit
  URL), and comments by any signed-in user.
- Project overview with statistics, most affected files, top contributors, recent activity.
- Global mutant list with filters, per-project list, dashboard, public profiles, global search,
  activity feed, settings page.
- Public read-only JSON API with OpenAPI description; rate limiting; sanitized Markdown; size limits.
- Seed data, unit/API tests, end-to-end workflow tests.

### Not yet implemented

- `Download patch` (`/api/mutants/[id]/patch`) and CSV/JSON bulk exports with versioned dataset
  releases and DOIs.
- Editing/deleting comments from the UI (the service layer already supports comment edits).
- Automatic rebasing of mutants to newer commits.
- Isolated execution runners (Docker) for automatic reproduction, CI and mutation-tool imports.
- GitHub App integration, pull-request links, CLI tooling.
- LLM-assisted analysis and automated equivalent-mutant detection.
- Notifications, subscriptions, gamification beyond the profile counters.
- A shared cache/rate-limit store (Redis) for multi-instance deployments.
