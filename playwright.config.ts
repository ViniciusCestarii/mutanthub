import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3300);
const baseURL = `http://localhost:${PORT}`;

/**
 * End-to-end tests run against the dev server with mocked authentication and
 * the fixture-backed GitHub client, on top of the seeded database.
 * Run `npm run db:setup` first (or `npm run db:seed`).
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: `npx next dev --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      ...process.env,
      AUTH_MOCK: "true",
      AUTH_URL: baseURL,
      GITHUB_MODE: "mock",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
