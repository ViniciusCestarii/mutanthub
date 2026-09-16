import { expect, test, type Page } from "@playwright/test";

/**
 * Pull request scope: track a PR (fixture-backed GitHub), open a changed file
 * in PR mode, submit a mutant on a changed line, and see it on the PR page.
 */

const OWNER = "curl";
const REPO = "curl";
const PR = 15908;
const CHANGED_LINE = 117;
const UNCHANGED_LINE = 30;

async function signInAs(page: Page, username: string) {
  await page.context().clearCookies();
  await page.goto("/signin");
  await page.locator("#mock-username").fill(username);
  await page.getByTestId("mock-sign-in-submit").click();
  await page.waitForURL(/\/dashboard/);
}

test.describe.configure({ mode: "serial" });

test.describe("pull requests", () => {
  const title = `PR mutant ${Date.now()}`;

  test("a signed-in user tracks a pull request and sees its changed files", async ({ page }) => {
    await signInAs(page, "frank");
    await page.goto(`/projects/${OWNER}/${REPO}`);
    await page.getByTestId("project-pulls-link").click();
    await page.waitForURL(/\/pulls$/);
    await page.waitForLoadState("networkidle");

    await page.getByTestId("track-pull-request-number").fill(String(PR));
    await page.getByTestId("track-pull-request-submit").click();
    await page.waitForURL(new RegExp(`/pulls/${PR}$`));

    await expect(page.getByTestId("pull-request-page")).toContainText(
      "url: validate port numbers before use",
    );
    await expect(page.getByTestId("pull-request-state")).toHaveAttribute("data-state", "OPEN");
    await expect(page.getByTestId("pull-request-files")).toContainText("lib/url.c");

    // Tracking an unknown PR is reported inline, not as a crash.
    await page.goto(`/projects/${OWNER}/${REPO}/pulls`);
    await page.getByTestId("track-pull-request-number").fill("999999");
    await page.getByTestId("track-pull-request-submit").click();
    await expect(page.getByText(/not found/i)).toBeVisible();
  });

  test("pull request mode highlights changed lines and scopes the submission", async ({ page }) => {
    await signInAs(page, "frank");
    await page.goto(`/projects/${OWNER}/${REPO}/code/lib/url.c?pr=${PR}#L${UNCHANGED_LINE}`);
    await expect(page.locator('[data-testid="status-selected-line"]:visible')).toHaveText(
      `L${UNCHANGED_LINE}`,
    );
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("pull-request-notice")).toContainText(`PR #${PR}`);
    await expect(page.getByTestId("mutants-panel").getByTestId("line-outside-diff")).toContainText(
      "Only lines changed by the pull request can be mutated",
    );
    await expect(page.getByTestId("mutants-panel").getByTestId("suggest-mutant")).toBeDisabled();

    // Wait for Monaco itself (loaded from a CDN, slow on CI) before changing the selection.
    await expect(page.locator(".monaco-editor .view-lines")).toBeVisible({ timeout: 60_000 });
    await page.evaluate((line) => {
      window.location.hash = `L${line}`;
    }, CHANGED_LINE);
    await expect(page.getByTestId("mutants-panel").getByTestId("line-in-diff")).toBeVisible();
    // Monaco marks the changed lines once the selection is scrolled into view.
    await expect(page.locator(".mh-line-changed").first()).toBeVisible({ timeout: 30_000 });

    await page.getByTestId("mutants-panel").getByTestId("suggest-mutant").click();
    const drawer = page.getByTestId("suggest-mutant-drawer");
    await expect(drawer.locator('input[name="pullRequestNumber"]')).toHaveValue(String(PR));
    await drawer.getByTestId("mutant-title").fill(title);
    const original = await drawer.getByTestId("mutant-original").inputValue();
    await drawer.getByTestId("mutant-mutated").fill(original.replace(">", ">="));
    await drawer.getByTestId("mutant-test-command").fill("make test-ci");
    await drawer.getByTestId("mutant-environment").fill("Debian 12, gcc 14 (pr mode)");
    await drawer.getByTestId("mutant-submit").click();
    await expect(drawer.getByTestId("mutant-success")).toBeVisible();
  });

  test("the server refuses a pull-request mutant outside the changed lines", async ({ page }) => {
    await signInAs(page, "frank");
    await page.goto(`/projects/${OWNER}/${REPO}/code/lib/url.c?pr=${PR}#L${CHANGED_LINE}`);
    await expect(page.locator('[data-testid="status-selected-line"]:visible')).toHaveText(
      `L${CHANGED_LINE}`,
    );
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("mutants-panel").getByTestId("line-in-diff")).toBeVisible();
    await page.getByTestId("mutants-panel").getByTestId("suggest-mutant").click();
    const drawer = page.getByTestId("suggest-mutant-drawer");
    await expect(drawer.locator('input[name="pullRequestNumber"]')).toHaveValue(String(PR));
    const original = await drawer.getByTestId("mutant-original").inputValue();
    await drawer.getByTestId("mutant-mutated").fill(`${original} /* outside */`);
    await drawer.getByTestId("mutant-test-command").fill("make test-ci");
    // Tamper with the form the way a crafted request would: move the mutant to an unchanged line.
    await drawer.locator('input[name="startLine"]').evaluate((el, line) => {
      (el as HTMLInputElement).value = String(line);
    }, UNCHANGED_LINE);
    await drawer.locator('input[name="endLine"]').evaluate((el, line) => {
      el.removeAttribute("min");
      (el as HTMLInputElement).value = String(line);
    }, UNCHANGED_LINE);
    await drawer.getByTestId("mutant-submit").click();
    await expect(drawer).toContainText(/outside the diff of PR #15908/);
    await expect(drawer.getByTestId("mutant-success")).toHaveCount(0);
  });

  test("the pull request page lists the mutant on the changed lines", async ({ page }) => {
    await page.goto(`/projects/${OWNER}/${REPO}/pulls/${PR}`);
    const table = page.getByTestId("mutant-table").first();
    await expect(table).toContainText(title);
    await expect(page.getByTestId("pull-request-files")).toContainText("lib/url.c");
    // The pull request shows in the project's list with its mutant count.
    await page.goto(`/projects/${OWNER}/${REPO}/pulls`);
    const row = page.getByTestId("pull-request-row").filter({ hasText: `#${PR}` });
    await expect(row).toBeVisible();
  });
});
