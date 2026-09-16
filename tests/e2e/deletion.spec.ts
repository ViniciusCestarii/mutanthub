import { expect, test, type Page } from "@playwright/test";

/**
 * Statement deletion: the drawer's "Delete these lines" toggle submits a
 * mutant with no replacement code; the detail page shows it as a deletion.
 */

const FILE_URL = "/projects/curl/curl/code/lib/url.c";
const LINE = 118;

async function signInAs(page: Page, username: string) {
  await page.context().clearCookies();
  await page.goto("/signin");
  await page.locator("#mock-username").fill(username);
  await page.getByTestId("mock-sign-in-submit").click();
  await page.waitForURL(/\/dashboard/);
}

test("a line can be deleted without replacement", async ({ page }) => {
  await signInAs(page, "frank");
  await page.goto(`${FILE_URL}#L${LINE}`);
  await expect(page.locator('[data-testid="status-selected-line"]:visible')).toHaveText(`L${LINE}`);
  await page.waitForLoadState("networkidle");
  await page.getByTestId("mutants-panel").getByTestId("suggest-mutant").click();
  const drawer = page.getByTestId("suggest-mutant-drawer");
  await drawer.getByTestId("mutant-title").fill(`Deletion e2e ${Date.now()}`);
  await drawer.getByTestId("mutant-mutated").fill("temporary");
  await drawer.getByTestId("mutant-delete-lines").check();
  await expect(drawer.getByTestId("mutant-mutated")).toHaveValue("");
  await expect(drawer.getByTestId("mutant-mutated")).toHaveAttribute("readonly", "");
  await drawer.getByTestId("mutant-test-command").fill("make test-ci");
  await drawer.getByTestId("mutant-submit").click();
  const href = await drawer.getByTestId("mutant-success-link").getAttribute("href");
  const id = Number(href!.split("/").pop());

  await page.goto(`/mutants/${id}`);
  await expect(page.locator('[data-testid="deletion-note"]:visible')).toContainText(
    "deletes the original lines",
  );
  await expect(page.getByTestId("mutant-header")).toContainText("Statement deletion");
  await page.getByRole("tab", { name: "Unified" }).click();
  await expect(page.locator('[data-testid="mutated-code"]:visible')).toContainText(
    "(lines deleted)",
  );
  const patch = await page.request.get(`/api/mutants/${id}/patch`);
  expect(patch.ok()).toBe(true);
  expect(await patch.text()).toMatch(/@@ -118,1 \+118,0 @@/);
});
