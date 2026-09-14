import { expect, test, type Page } from "@playwright/test";

/**
 * Critical-path workflow against the seeded database with mocked login and
 * fixture-backed GitHub data:
 *
 * 1. mocked login  2. open project  3. navigate to a file  4. select a line
 * 5. submit a mutant  6. reviewer opens the queue  7. reviewer approves
 * 8. another user records a reproduction  9. a user posts a comment
 */

const PROJECT = { owner: "bitcoin", repo: "bitcoin" };
const FILE = "src/script/interpreter.cpp";
const LINE = 165;

async function signInAs(page: Page, username: string) {
  await page.context().clearCookies();
  await page.goto("/signin");
  await page.getByTestId(`mock-user-${username}`).click();
  await page.getByTestId("mock-sign-in-submit").click();
  await page.waitForURL(/\/dashboard/);
  await expect(page.getByTestId("user-menu")).toBeVisible();
}

test.describe.configure({ mode: "serial" });

test.describe("mutant workflow", () => {
  let mutantId: number;
  const title = `E2E mutant ${Date.now()}`;

  test("contributor browses code, selects a line and submits a mutant", async ({ page }) => {
    await signInAs(page, "dave");

    // Open the project overview and go to the code browser.
    await page.goto(`/projects/${PROJECT.owner}/${PROJECT.repo}`);
    await expect(page.getByTestId("project-overview")).toBeVisible();
    await page.getByTestId("browse-code").click();
    await page.waitForURL(/\/code/);

    // Navigate through the file tree: src -> script -> interpreter.cpp
    const tree = page.getByTestId("file-tree");
    await expect(tree).toBeVisible();
    await tree.getByRole("button", { name: /^src$/ }).click();
    await tree.getByRole("button", { name: /^script$/ }).click();
    await tree.getByRole("link", { name: /^interpreter\.cpp$/ }).click();
    await page.waitForURL(new RegExp(`/code/${FILE.replace(/\//g, "\\/")}`));

    // Wait for Monaco to render, then select a line through the URL hash
    // (stable across Monaco versions) and confirm the side panel reflects it.
    await expect(page.getByTestId("code-viewer")).toBeVisible();
    await page.evaluate((line) => {
      window.location.hash = `L${line}`;
    }, LINE);
    await expect(page.getByTestId("status-selected-line")).toHaveText(`L${LINE}`);
    await expect(page.getByTestId("selected-line-text")).not.toBeEmpty();

    // Existing seed mutants on this file appear in the panel with gutter counts.
    await expect(page.getByTestId("mutants-panel")).toContainText("mutant");

    // Suggest a mutant.
    await page.waitForLoadState("networkidle");
    await page.getByTestId("mutants-panel").getByTestId("suggest-mutant").click();
    const drawer = page.getByTestId("suggest-mutant-drawer");
    await expect(drawer).toBeVisible();

    await drawer.getByTestId("mutant-title").fill(title);
    const original = await drawer.getByTestId("mutant-original").inputValue();
    expect(original.length).toBeGreaterThan(0);
    await drawer.getByTestId("mutant-mutated").fill(original.replace(">", ">="));
    await drawer
      .getByTestId("mutant-test-command")
      .fill("ctest --test-dir build --output-on-failure");
    await drawer.getByTestId("mutant-environment").fill("Ubuntu 24.04, gcc 14 (e2e)");
    await drawer.getByTestId("mutant-submit").click();

    await expect(drawer.getByTestId("mutant-success")).toBeVisible();
    const href = await drawer.getByTestId("mutant-success-link").getAttribute("href");
    expect(href).toMatch(/\/mutants\/\d+$/);
    mutantId = Number(href!.split("/").pop());

    // The mutant page shows the submission as pending with the evidence.
    await page.goto(`/mutants/${mutantId}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(title);
    await expect(page.getByTestId("review-status").first()).toHaveAttribute(
      "data-status",
      "PENDING",
    );
    await expect(page.getByText("ctest --test-dir build --output-on-failure")).toBeVisible();
  });

  test("reviewer finds the submission in the queue and approves it", async ({ page }) => {
    await signInAs(page, "bob");
    await page.getByTestId("nav-review").click();
    await page.waitForURL(/\/review/);

    const item = page.locator(`[data-testid="review-item"][data-mutant-id="${mutantId}"]`);
    await expect(item).toBeVisible();
    await item.click();
    await page.waitForURL(new RegExp(`selected=${mutantId}`));

    const detail = page.getByTestId("review-detail");
    await expect(detail).toContainText(title);
    await page.waitForLoadState("networkidle");
    await detail.getByTestId("review-action-APPROVE").click();
    await expect(detail.getByTestId("review-status").first()).toHaveAttribute(
      "data-status",
      "APPROVED",
    );

    // Approval is reflected on the public page and in the history.
    await page.goto(`/mutants/${mutantId}`);
    await expect(page.getByTestId("review-status").first()).toHaveAttribute(
      "data-status",
      "APPROVED",
    );
    await expect(page.getByTestId("status-history")).toContainText("APPROVED");
  });

  test("another user records a reproduction", async ({ page }) => {
    await signInAs(page, "erin");
    await page.goto(`/mutants/${mutantId}`);

    await page.waitForLoadState("networkidle");
    await page.getByTestId("validation-open").click();
    const form = page.getByTestId("validation-form");
    await form.getByTestId("validation-result-SURVIVED").check({ force: true });
    await form
      .getByTestId("validation-command")
      .fill("git apply mutant.patch && ctest --test-dir build");
    await form.getByTestId("validation-environment").fill("Fedora 40, gcc 14");
    await form.getByTestId("validation-submit").click();

    await expect(page.getByTestId("validation-item")).toHaveCount(1);
    await expect(page.getByTestId("validation-summary")).toContainText(
      "confirmed by 1 contributor",
    );
  });

  test("a user posts a comment and the history is complete", async ({ page }) => {
    await signInAs(page, "alice");
    await page.goto(`/mutants/${mutantId}`);

    const body = "Reproduced on my side as well. **Looks like a real gap** in script_tests.";
    await page.waitForLoadState("networkidle");
    await page.getByTestId("comment-body").fill(body);
    await page.getByTestId("comment-submit").click();
    await expect(page.getByTestId("comment-item").last()).toContainText("Looks like a real gap");

    const history = page.getByTestId("status-history");
    await expect(history).toContainText("PENDING");
    await expect(history).toContainText("APPROVED");
    await expect(history).toContainText("SURVIVED");
  });

  test("anonymous visitors cannot access the review queue but can read mutants", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await page.goto("/review");
    await expect(page).toHaveURL(/\/signin/);
    await page.goto(`/mutants/${mutantId}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(title);
    const res = await page.request.get(`/api/mutants/${mutantId}`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.data.reviewStatus).toBe("APPROVED");
    expect(json.data.reproductions).toBe(1);
  });
});
