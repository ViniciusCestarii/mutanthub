Test suites, how to run them, and what continuous integration checks.

# Testing

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
(members, roles, last-maintainer protection, deactivation), and a fourth covers notifications
(submission notice to reviewers, decision and comment notices to the submitter, mark-as-read).

## Continuous integration

`.github/workflows/ci.yml` runs on every push to `main` and on pull requests:

- **checks**: `npm ci`, lint, type-check, Prettier check, unit + API tests, production build.
- **e2e**: the same install, then Playwright (Chromium) against a PostgreSQL 17 service
  container with migrations and seed applied, using mocked login and fixture repositories.
  The HTML report and traces are uploaded as an artifact when a test fails.

Both jobs need no secrets: `DATABASE_URL` points at the service container and `AUTH_SECRET` is a
throwaway value set in the workflow.
