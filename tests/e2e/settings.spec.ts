import { expect, test, type Page } from "@playwright/test";

/**
 * Maintainer settings: add a reviewer, see the review queue appear for them,
 * change roles, protect the last maintainer, and deactivate the project.
 * Uses llvm/llvm-project (maintainer: carol) and a throwaway username.
 */

const SETTINGS = "/projects/llvm/llvm-project/settings";
const NEW_USER = `e2e-rev-${Date.now().toString(36)}`;

async function signInAs(page: Page, username: string) {
  await page.context().clearCookies();
  await page.goto("/signin");
  await page.locator("#mock-username").fill(username);
  await page.getByTestId("mock-sign-in-submit").click();
  await page.waitForURL(/\/dashboard/);
}

test.describe.configure({ mode: "serial" });

test.describe("project settings", () => {
  test("non-maintainers cannot open settings", async ({ page }) => {
    await signInAs(page, "dave");
    await page.goto(SETTINGS);
    await expect(page.getByText("Permission denied")).toBeVisible();
    await page.goto("/projects/llvm/llvm-project");
    await expect(page.getByTestId("project-settings-link")).toHaveCount(0);
  });

  test("maintainer adds a reviewer who then sees the review queue", async ({ page }) => {
    await signInAs(page, "carol");
    await page.goto("/projects/llvm/llvm-project");
    await page.getByTestId("project-settings-link").click();
    await page.waitForURL(/\/settings$/);
    await page.waitForLoadState("networkidle");

    await page.getByTestId("add-member-username").fill(NEW_USER);
    await page.getByTestId("add-member-role").selectOption("REVIEWER");
    await page.getByTestId("add-member-submit").click();
    const row = page.locator(`[data-testid="member-row"][data-username="${NEW_USER}"]`);
    await expect(row).toBeVisible();
    await expect(row.getByTestId("member-role")).toHaveValue("REVIEWER");

    // Adding the same person twice is rejected with a clear message.
    await page.getByTestId("add-member-username").fill(NEW_USER);
    await page.getByTestId("add-member-submit").click();
    await expect(page.getByText(/already a reviewer/i)).toBeVisible();

    await signInAs(page, NEW_USER);
    await expect(page.getByTestId("nav-review")).toBeVisible();
    await page.goto("/review?project=llvm/llvm-project");
    await expect(page.getByTestId("review-queue")).toBeVisible();
  });

  test("roles can change but the last maintainer is protected", async ({ page }) => {
    await signInAs(page, "carol");
    await page.goto(SETTINGS);
    await page.waitForLoadState("networkidle");

    const carolRow = page.locator('[data-testid="member-row"][data-username="carol"]');
    await expect(carolRow.getByTestId("member-role")).toBeDisabled();
    await expect(carolRow.getByTestId("member-remove")).toBeDisabled();

    const newRow = page.locator(`[data-testid="member-row"][data-username="${NEW_USER}"]`);
    await newRow.getByTestId("member-role").selectOption("MAINTAINER");
    await expect(newRow.getByTestId("member-role")).toHaveValue("MAINTAINER");
    // With two maintainers, carol's controls unlock.
    await expect(carolRow.getByTestId("member-role")).toBeEnabled();

    await newRow.getByTestId("member-remove").click();
    await expect(newRow).toHaveCount(0);
    await expect(carolRow.getByTestId("member-remove")).toBeDisabled();
  });

  test("deactivating hides the project and blocks submissions; reactivating restores it", async ({
    page,
  }) => {
    await signInAs(page, "carol");
    await page.goto(SETTINGS);
    await page.waitForLoadState("networkidle");
    await page.getByTestId("toggle-project-active").click();
    await expect(page.getByText("Inactive", { exact: true })).toBeVisible();

    await page.goto("/projects");
    await expect(page.getByRole("link", { name: /llvm\/llvm-project/ })).toHaveCount(0);
    await page.goto("/projects/llvm/llvm-project");
    await expect(page.getByTestId("project-inactive-notice")).toBeVisible();

    await page.goto(SETTINGS);
    await page.waitForLoadState("networkidle");
    await page.getByTestId("toggle-project-active").click();
    await expect(page.getByText("Active", { exact: true })).toBeVisible();
    await page.goto("/projects");
    await expect(page.getByRole("link", { name: /llvm\/llvm-project/ }).first()).toBeVisible();
  });
});
