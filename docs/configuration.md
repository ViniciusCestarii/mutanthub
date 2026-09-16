Every environment variable, the authentication and GitHub access modes, and how to set up a GitHub App.

# Configuration

All variables are documented in [`.env.example`](../.env.example).

| Variable                                | Purpose                                                                                                                                                                                                                                                                                                          |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                          | PostgreSQL connection string.                                                                                                                                                                                                                                                                                    |
| `AUTH_SECRET`                           | Secret used to sign session JWTs.                                                                                                                                                                                                                                                                                |
| `AUTH_URL`                              | Public URL of the app (OAuth callbacks).                                                                                                                                                                                                                                                                         |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | GitHub OAuth app credentials. Callback URL: `<AUTH_URL>/api/auth/callback/github`. Scope requested: `read:user user:email` (no write access). The access token stays in the encrypted session cookie and is used for that user's repository reads, so each signed-in user has their own 5,000 requests per hour. |
| `AUTH_MOCK`                             | `true` forces the mocked login even when OAuth is configured (development / tests only).                                                                                                                                                                                                                         |
| `PROJECT_REGISTRATION`                  | `admins` (default): only global admins can register projects; `users`: any signed-in account can.                                                                                                                                                                                                                |
| `ADMIN_GITHUB_USERNAMES`                | Comma-separated GitHub usernames promoted to global admin when they sign in (bootstrap).                                                                                                                                                                                                                         |
| `GITHUB_TOKEN`                          | Token used for repository browsing (public read access is enough). Raises the API rate limit to 5,000 req/h.                                                                                                                                                                                                     |
| `GITHUB_MODE`                           | `auto` (live when a token is present, otherwise fixtures), `live`, or `mock`.                                                                                                                                                                                                                                    |
| `CRON_SECRET`                           | Bearer token for scheduled jobs such as `POST /api/jobs/drift` (see [Deployment](deployment.md)). Jobs are disabled when unset.                                                                                                                                                                                  |
| `GITHUB_CACHE_TTL`                      | Seconds to cache GitHub responses in memory (immutable commits are cached for 24 h).                                                                                                                                                                                                                             |

## Making yourself an admin

Set `ADMIN_GITHUB_USERNAMES="your-github-login"` before signing in (or sign out and back in
after setting it). Admins can review and configure every project. Alternatively, run
`UPDATE "User" SET "globalRole" = 'ADMIN' WHERE "githubUsername" = 'your-github-login';`
against the database.

## Using real GitHub data

1. Create an OAuth app at GitHub → Settings → Developer settings → OAuth Apps, with the callback
   URL above, and copy the id/secret into `.env`.
2. Create a personal access token with public repository read access and set `GITHUB_TOKEN`.
3. Restart the dev server. Sign in with GitHub, open **Projects → Register repository** and add
   any public repository (`owner/name`). The person who registers a project becomes its
   maintainer and can review submissions.

The seeded fixture projects will show "Not found on GitHub" for their fake commits when running
in live mode; register real repositories instead, or keep `GITHUB_MODE=mock` for the seed data.

## GitHub App (recommended for deployments)

A personal token is shared by everyone and capped at 5,000 requests per hour. A GitHub App
gives each installation its own 5,000 requests per hour and lets repository owners grant access
explicitly. MutantHub supports both at the same time:

1. Create a GitHub App (Settings -> Developer settings -> GitHub Apps). Repository permissions:
   **Contents: Read-only**, **Metadata: Read-only**, **Pull requests: Read-only** and
   **Checks: Read and write** (for the MutantHub check on pull requests). Subscribe to the
   **Installation**, **Installation repositories** and **Pull request** events. Webhook URL: `<AUTH_URL>/api/github/webhook` with a
   secret of your choice. No user authorization is needed; sign-in stays on the OAuth app.
2. Generate a private key and set `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` (PEM with `\n`
   line breaks, or base64), `GITHUB_APP_SLUG` and `GITHUB_APP_WEBHOOK_SECRET` in `.env`.
3. Install the app on the repositories you want to browse. Project maintainers see the
   installation status and an install link on the project settings page.

For each request MutantHub resolves the installation covering the repository (cached for ten
minutes, invalidated by the webhook), mints a one-hour installation token, and uses it. If the
app is not installed on a repository, requests fall back to `GITHUB_TOKEN`, then to anonymous
access. App JWTs are signed with Node's crypto module; no extra dependency is involved.
