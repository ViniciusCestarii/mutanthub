import { expect, test, type Page } from "@playwright/test";

/**
 * Drift check: a maintainer checks every open mutant against the default
 * branch; a mutant whose original code is not there is flagged as gone on the
 * list and the detail page, the submitter is notified, and the list filter
 * finds it. Mutants whose code still applies are not flagged.
 */

const FILE_URL = "/projects/curl/curl/code/lib/url.c";
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
  const title = `Drift e2e ${Date.now()}`;

  test("a mutant whose original code was edited away is submitted", async ({ page }) => {
    await signInAs(page, "frank");
    await page.goto(`${FILE_URL}#L${LINE}`);
    await expect(page.locator('[data-testid="status-selected-line"]:visible')).toHaveText(
      `L${LINE}`,
    );
    await page.waitForLoadState("networkidle");
    await page.getByTestId("mutants-panel").getByTestId("suggest-mutant").click();
    const drawer = page.getByTestId("suggest-mutant-drawer");
    await drawer.getByTestId("mutant-title").fill(title);
    // Original code that does not exist in the file: the check must report it as gone.
    await drawer.getByTestId("mutant-original").fill("  this_line_never_existed(42);");
    await drawer.getByTestId("mutant-mutated").fill("  this_line_never_existed(43);");
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
