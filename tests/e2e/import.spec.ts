import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * Bulk import: an administrator uploads a tool's output, sees a dry-run
 * report (valid rows, duplicates, errors), imports, and the mutants appear
 * as approved with the tool as their source. Non-admins are refused.
 */

const EXAMPLE = path.join(process.cwd(), "docs/examples/import-example.json");

async function signInAs(page: Page, username: string) {
  await page.context().clearCookies();
  await page.goto("/signin");
  await page.locator("#mock-username").fill(username);
  await page.getByTestId("mock-sign-in-submit").click();
  await page.waitForURL(/\/dashboard/);
}

test.describe.configure({ mode: "serial" });

test.describe("bulk import", () => {
  test("an admin checks the file, imports it and the mutants are approved", async ({ page }) => {
    await signInAs(page, "bruno");
    await page.goto("/projects/curl/curl/settings");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("import-link").click();
    await expect(page.getByTestId("import-page")).toBeVisible();
    await page.waitForLoadState("networkidle");

    await page.getByTestId("import-file").setInputFiles(EXAMPLE);
    await page.getByTestId("import-dry-run").click();

    const report = page.getByTestId("import-report");
    await expect(report).toBeVisible();
    // 5 rows: 3 valid, 1 duplicate within the file, 1 whose original code is not in the file.
    await expect(report).toContainText("example-mutator 1.0.0");
    await expect(page.getByTestId("import-errors")).toContainText("row 5");
    await expect(page.getByTestId("import-errors")).toContainText("originalCode not found");
    await expect(page.getByTestId("import-duplicates")).toContainText("row 4: duplicate of row 3");
    await expect(page.getByTestId("import-commit")).toHaveText(/Import 3 mutants as approved/);

    await page.getByTestId("import-commit").click();
    await expect(page.getByTestId("import-done")).toContainText("3 mutants imported");
    await expect(page.getByTestId("import-batches")).toContainText(
      "3 mutants from example-mutator 1.0.0",
    );

    await page.getByTestId("import-view-link").click();
    await expect(page).toHaveURL(/\/projects\/curl\/curl\/mutants\?batch=/);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Off by one on the INT_MAX bound in unescape")).toBeVisible();
    await page.getByText("Off by one on the INT_MAX bound in unescape").click();
    await page.waitForURL(/\/mutants\/\d+$/);
    await expect(page.getByTestId("mutant-header").getByTestId("review-status")).toHaveAttribute(
      "data-status",
      "APPROVED",
    );
    await expect(page.getByTestId("status-history")).toContainText(
      "Imported from example-mutator 1.0.0 by an administrator",
    );
  });

  test("re-importing the same file skips the existing mutants", async ({ page }) => {
    await signInAs(page, "bruno");
    await page.goto("/projects/curl/curl/import");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("import-file").setInputFiles(EXAMPLE);
    await page.getByTestId("import-dry-run").click();
    await expect(page.getByTestId("import-duplicates")).toContainText(
      "already in the catalogue as #",
    );
    await expect(page.getByTestId("import-commit")).toBeDisabled();
  });

  test("non-admins cannot open the page or call the endpoint", async ({ page }) => {
    await signInAs(page, "frank");
    await page.goto("/projects/curl/curl/import");
    await expect(page.getByText(/Only administrators can import/)).toBeVisible();
    const res = await page.request.post("/api/projects/curl/curl/import", {
      multipart: {
        file: { name: "m.json", mimeType: "application/json", buffer: readFileSync(EXAMPLE) },
        mode: "commit",
      },
    });
    expect(res.status()).toBe(403);
  });
});
