import { expect, test, type Page } from "@playwright/test";

/**
 * Drift check: a maintainer checks every open mutant against the default
 * branch; a mutant whose original code is not there is flagged as gone on the
 * list and the detail page, the submitter is notified, and the list filter
 * finds it. Mutants whose code still applies are not flagged.
 */

const FILE_URL = "/projects/curl/curl/code/lib/url.c";
const OLD_COMMIT = "a4c7e1f9b3d5a7c9e1f3b5d7a9c1e3f5b7d9a1c3";
const LINE = 120;

async function signInAs(page: Page, username: string) {
  await page.context().clearCookies();
  await page.goto("/signin");
  await page.locator("#mock-username").fill(username);
  await page.getByTestId("mock-sign-in-submit").click();
  await page.waitForURL(/\/dashboard/);
}

test.describe.configure({ mode: "serial" });

test.describe("drift check", () => {
  let goneId: number;

  // Real drift: L120 of lib/url.c reads `if(digits >= MAX_PORT_DIGITS)` at the
  // older commit and `if(digits > 5)` at the head (see fixtures/overlays), so a
  // mutant submitted against the older revision no longer applies at HEAD.
  test("a mutant submitted against an older revision is out of date at HEAD", async ({ page }) => {
    await signInAs(page, "frank");
    await page.goto(`${FILE_URL}?ref=${OLD_COMMIT}#L${LINE}`);
    await expect(page.locator('[data-testid="status-selected-line"]:visible')).toHaveText(
      `L${LINE}`,
    );
    await page.waitForLoadState("networkidle");
    const drawer = page.getByTestId("suggest-mutant-drawer");
    await page.getByTestId("mutants-panel").getByTestId("suggest-mutant").click();
    await expect(drawer.getByTestId("mutant-original")).toHaveValue(/MAX_PORT_DIGITS/);
    await drawer.getByTestId("mutant-title").fill(`Drift e2e ${Date.now()}`);
    await drawer.getByTestId("mutant-mutated").fill("    if(digits > MAX_PORT_DIGITS)");
    await drawer.getByTestId("mutant-test-command").fill("make test-ci");
    await drawer.getByTestId("mutant-submit").click();
    const href = await drawer.getByTestId("mutant-success-link").getAttribute("href");
    goneId = Number(href!.split("/").pop());
    expect(goneId).toBeGreaterThan(0);
  });

  test("the maintainer runs the check from the settings page", async ({ page }) => {
    await signInAs(page, "alice");
    await page.goto("/projects/curl/curl/settings");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("drift-last-checked")).toContainText("Never checked");
    await page.getByTestId("check-drift").click();
    await expect(page.getByTestId("drift-last-checked")).toContainText(
      /Just checked at [0-9a-f]{7}/,
    );
    await expect(page.getByTestId("drift-last-checked")).toContainText(/[1-9]\d* gone/);
    await expect(page.getByTestId("audit-trail")).toContainText("checked drift");
  });

  test("gone mutants are flagged, filterable and the submitter is told", async ({ page }) => {
    await signInAs(page, "frank");
    await page.goto(`/mutants/${goneId}`);
    const notice = page.locator('[data-testid="drift-notice"]:visible');
    await expect(notice).toHaveAttribute("data-status", "GONE");
    await expect(notice).toContainText("no longer on the default branch");
    await expect(notice.getByText("report the killing test")).toBeVisible();

    await page.goto("/projects/curl/curl/mutants?drift=GONE");
    const row = page.locator(`[data-testid="mutant-row"][data-mutant-id="${goneId}"]`);
    await expect(row).toBeVisible();
    await expect(row.getByTestId("drift-status")).toHaveText("gone at HEAD");

    // A seeded mutant whose code still applies carries no badge.
    await page.goto("/projects/curl/curl/mutants?drift=APPLIES&file=lib/parsedate.c");
    const applies = page.getByTestId("mutant-row").first();
    await expect(applies).toBeVisible();
    await expect(applies.getByTestId("drift-status")).toHaveCount(0);

    await page.goto("/notifications");
    await expect(
      page.getByText(`The code of #${goneId} changed on the default branch`, { exact: false }),
    ).toBeVisible();
  });
});
