import { expect, test, type Page } from "@playwright/test";

/**
 * Title and environment are optional: an empty title is generated from the
 * operator and location, a missing environment shows as "not specified" and
 * reviewers get a hint to ask for it.
 */

const FILE_URL = "/projects/curl/curl/code/lib/url.c";
const LINE = 120;

async function signInAs(page: Page, username: string) {
  await page.context().clearCookies();
  await page.goto("/signin");
  await page.getByTestId(`mock-user-${username}`).click();
  await page.getByTestId("mock-sign-in-submit").click();
  await page.waitForURL(/\/dashboard/);
}

test.describe.configure({ mode: "serial" });

test.describe("optional title and environment", () => {
  let mutantId: number;

  test("a submission without title or environment gets a generated title", async ({ page }) => {
    await signInAs(page, "frank");
    await page.goto(`${FILE_URL}#L${LINE}`);
    await expect(page.locator('[data-testid="status-selected-line"]:visible')).toHaveText(
      `L${LINE}`,
    );
    await page.waitForLoadState("networkidle");
    await page.getByTestId("mutants-panel").getByTestId("suggest-mutant").click();
    const drawer = page.getByTestId("suggest-mutant-drawer");
    const original = await drawer.getByTestId("mutant-original").inputValue();
    await drawer.getByTestId("mutant-mutated").fill(`${original} /* optional-fields e2e */`);
    await drawer.getByTestId("mutant-test-command").fill("make test-ci");
    await drawer.getByTestId("mutant-submit").click();
    const href = await drawer.getByTestId("mutant-success-link").getAttribute("href");
    mutantId = Number(href!.split("/").pop());

    await page.goto(`/mutants/${mutantId}`);
    await expect(page.getByTestId("mutant-header")).toContainText(
      `Unknown mutation at url.c:${LINE}`,
    );
    await expect(page.locator('[data-testid="evidence-environment"]:visible')).toHaveText(
      "not specified",
    );
  });

  test("the reviewer sees a hint that no environment was given", async ({ page }) => {
    await signInAs(page, "alice");
    await page.goto(`/review?selected=${mutantId}`);
    await expect(page.getByTestId("review-environment-hint")).toContainText(
      "No environment was given",
    );
  });
});
