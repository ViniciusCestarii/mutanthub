import { expect, test, type Page } from "@playwright/test";

/**
 * Submission lifecycle: edit -> needs information -> resubmit -> withdraw ->
 * resubmit, plus a reproduction that links the killing test.
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

async function submitMutant(page: Page, title: string): Promise<number> {
  await page.goto(`${FILE_URL}#L${LINE}`);
  await expect(page.getByTestId("status-selected-line")).toHaveText(`L${LINE}`);
  await page.waitForLoadState("networkidle");
  await page.getByTestId("mutants-panel").getByTestId("suggest-mutant").click();
  const drawer = page.getByTestId("suggest-mutant-drawer");
  await drawer.getByTestId("mutant-title").fill(title);
  const original = await drawer.getByTestId("mutant-original").inputValue();
  await drawer.getByTestId("mutant-mutated").fill(original.replace("5", "6"));
  await drawer.getByTestId("mutant-test-command").fill("make test-ci");
  await drawer.getByTestId("mutant-environment").fill("Debian 12, gcc 14 (e2e lifecycle)");
  await drawer.getByTestId("mutant-submit").click();
  const href = await drawer.getByTestId("mutant-success-link").getAttribute("href");
  return Number(href!.split("/").pop());
}

test.describe.configure({ mode: "serial" });

test.describe("submission lifecycle", () => {
  let mutantId: number;
  const title = `Lifecycle mutant ${Date.now()}`;

  test("submitter edits a pending submission", async ({ page }) => {
    await signInAs(page, "frank");
    mutantId = await submitMutant(page, title);

    await page.goto(`/mutants/${mutantId}`);
    await page.waitForLoadState("networkidle");
    await page.getByTestId("lifecycle-edit").click();
    await page.waitForURL(new RegExp(`/mutants/${mutantId}/edit`));

    await page.getByTestId("edit-title").fill(`${title} (edited)`);
    await page.getByTestId("edit-test-command").fill("make test-ci TFLAGS=-p");
    await page.getByTestId("edit-reason").fill("Added the parallel flag used in the actual run.");
    await page.getByTestId("edit-submit").click();
    await page.waitForURL(new RegExp(`/mutants/${mutantId}$`));

    await expect(page.getByRole("heading", { level: 1 })).toContainText("(edited)");
    await expect(page.getByTestId("status-history")).toContainText("Submission edited");
    await expect(page.getByTestId("status-history")).toContainText("Added the parallel flag");
    await expect(page.getByTestId("test-evidence")).toContainText("Current evidence");
    await expect(page.getByTestId("test-evidence")).toContainText("make test-ci TFLAGS=-p");
  });

  test("reviewer asks for information and the submitter resubmits", async ({ page }) => {
    await signInAs(page, "alice");
    await page.goto(`/review?selected=${mutantId}`);
    await page.waitForLoadState("networkidle");
    const detail = page.getByTestId("review-detail");
    await detail.getByTestId("review-comment").fill("Please attach the ctest output.");
    await detail.getByTestId("review-action-NEEDS_INFORMATION").click();
    await expect(detail.getByTestId("review-status").first()).toHaveAttribute(
      "data-status",
      "NEEDS_INFORMATION",
    );

    await signInAs(page, "frank");
    await page.goto(`/mutants/${mutantId}`);
    await page.waitForLoadState("networkidle");
    await page.getByTestId("lifecycle-resubmit").click();
    await page.getByTestId("resubmit-comment").fill("Output attached in the notes.");
    await page.getByTestId("resubmit-submit").click();
    await expect(page.getByTestId("review-status").first()).toHaveAttribute(
      "data-status",
      "PENDING",
    );
    await expect(page.getByTestId("status-history")).toContainText("Output attached in the notes.");
  });

  test("submitter withdraws, the queue hides it, and resubmission restores it", async ({
    page,
  }) => {
    await signInAs(page, "frank");
    await page.goto(`/mutants/${mutantId}`);
    await page.waitForLoadState("networkidle");
    await page.getByTestId("lifecycle-withdraw").click();
    await page.getByTestId("withdraw-reason").fill("Realised the mutant is equivalent.");
    await page.getByTestId("withdraw-submit").click();
    await expect(page.getByTestId("review-status").first()).toHaveAttribute(
      "data-status",
      "WITHDRAWN",
    );
    await expect(page.getByTestId("lifecycle-edit")).toHaveCount(0);

    await signInAs(page, "alice");
    await page.goto("/review");
    await expect(page.getByTestId("review-queue")).toBeVisible();
    await expect(
      page.locator(`[data-testid="review-item"][data-mutant-id="${mutantId}"]`),
    ).toHaveCount(0);

    await signInAs(page, "frank");
    await page.goto(`/mutants/${mutantId}`);
    await page.waitForLoadState("networkidle");
    await page.getByTestId("lifecycle-resubmit").click();
    await page.getByTestId("resubmit-submit").click();
    await expect(page.getByTestId("review-status").first()).toHaveAttribute(
      "data-status",
      "PENDING",
    );
  });

  test("a reproduction can reference the killing test", async ({ page }) => {
    await signInAs(page, "erin");
    await page.goto(`/mutants/${mutantId}`);
    await page.waitForLoadState("networkidle");
    await page.getByTestId("validation-open").click();
    const form = page.getByTestId("validation-form");
    await form.getByTestId("validation-result-KILLED").check({ force: true });
    await form.getByTestId("validation-killing-test").fill("tests/unit/unit1300.c");
    await form.getByTestId("validation-submit").click();
    await expect(page.getByTestId("validation-killing-test-ref")).toContainText(
      "tests/unit/unit1300.c",
    );

    const res = await page.request.get(`/api/mutants/${mutantId}`);
    const json = await res.json();
    expect(json.data.validations[0].killingTestRef).toBe("tests/unit/unit1300.c");
    expect(json.data.history.some((h: { kind: string }) => h.kind === "SUBMISSION")).toBe(true);
  });
});
