# MutantHub

[![CI](https://github.com/brunoerg/mutanthub/actions/workflows/ci.yml/badge.svg)](https://github.com/brunoerg/mutanthub/actions/workflows/ci.yml)

A collaborative platform for cataloguing, reviewing, reproducing and investigating software
mutants that survive the test suites of open-source projects.

MutantHub feels like a mix of GitHub, code review and a small read-only IDE. Contributors browse
a repository at an exact commit, select a line, submit a mutant with the git diff and the
commands they used to test it, reviewers approve or classify it, other contributors reproduce
the result, and every state change is kept as history so the data can become a public dataset.

> MutantHub never executes user-provided commands or patches; they are stored and displayed as
> text. A surviving mutant is not automatically a weakness of the test suite: it may be
> equivalent, invalid, environment-dependent or simply not reproduced yet.

## Features

- Sign in with GitHub; a mocked login for local development and tests.
- Browse registered repositories at any commit in a Monaco-based viewer with mutant indicators
  in the gutter; suggest a mutant from a selected line with diff preview and duplicate detection.
- Mutant pages with side-by-side and unified diffs, test evidence, reproductions, Markdown
  discussion and a complete status history; independent review and outcome states.
- Review queue for reviewers and maintainers; submission lifecycle (edit, resubmit, withdraw).
- Pull request scope: track a pull request, browse its changed lines, scope mutants to it, and
  publish a non-blocking check run on GitHub.
- Notifications, project statistics, dashboard, profiles, search, maintainer settings with an
  audit trail, and a public read-only JSON API.
- Dataset exports as JSON and CSV, per-mutant patch downloads, and frozen, hashed snapshots that
  a paper can cite.
- GitHub App support for per-installation rate limits; Redis-backed stores for multi-instance
  deployments; Docker images and a compose stack.

## Quick start

```bash
npm install
docker compose up -d          # PostgreSQL for development
cp .env.example .env          # set AUTH_SECRET; everything else works out of the box
npm run db:setup              # migrate + seed demo data
npm run dev                   # http://localhost:3000
```

Without GitHub credentials the app runs in mock mode: pick any seeded account on the sign-in
page and browse three fixture repositories. See [Getting started](docs/getting-started.md) for
the details and [Configuration](docs/configuration.md) to connect real GitHub.

## Documentation

| Document                                   | What it covers                                                   |
| ------------------------------------------ | ---------------------------------------------------------------- |
| [Getting started](docs/getting-started.md) | Local setup, seeded accounts, npm scripts                        |
| [Configuration](docs/configuration.md)     | Environment variables, GitHub OAuth, GitHub App, admin bootstrap |
| [Architecture](docs/architecture.md)       | Stack, layers, domain model, duplicate detection, routes         |
| [Deployment](docs/deployment.md)           | Docker runbook: first start, upgrades, migrations, backups       |
| [Public API](docs/api.md)                  | Read-only JSON endpoints for dataset consumers                   |
| [Importing mutants](docs/import.md)        | Bulk import of mutation-tool output (administrators)             |
| [Testing](docs/testing.md)                 | Unit, API and end-to-end suites; continuous integration          |
| [Security](docs/SECURITY.md)               | Permission matrix, CSP, audit trail, deployer checklist          |
| [Status](docs/status.md)                   | What is implemented and what is planned                          |

## Contributing

Run `npm test` and `npm run test:e2e` before opening a pull request; CI runs lint, type-check,
Prettier, unit, API and end-to-end suites on every push and pull request.
