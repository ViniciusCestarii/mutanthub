import { expect, test, type Page } from "@playwright/test";

/**
 * Notifications: a review decision notifies the submitter; opening the
 * notification marks it read and lands on the mutant; a comment notifies the
 * submitter; "mark all read" clears the badge.
 */

const FILE_URL = "/projects/curl/curl/code/lib/http.c";
const LINE = 49;

async function signInAs(page: Page, username: string) {
  await page.context().clearCookies();
  await page.goto("/signin");
  await page.locator("#mock-username").fill(username);
  await page.getByTestId("mock-sign-in-submit").click();
  await page.waitForURL(/\/dashboard/);
}

async function unreadCount(page: Page): Promise<number> {
  const bell = page.getByTestId("notifications-bell");
  await expect(bell).toBeVisible();
  return Number((await bell.getAttribute("data-unread")) ?? "0");
}

test.describe.configure({ mode: "serial" });

test.describe("notifications", () => {
  const submitter = `e2e-notif-${Date.now().toString(36)}`;
  let mutantId: number;
  const title = `Notification mutant ${Date.now()}`;

  test("a fresh user submits a mutant and has an empty inbox", async ({ page }) => {
    await signInAs(page, submitter);
    expect(await unreadCount(page)).toBe(0);

    await page.goto(`${FILE_URL}#L${LINE}`);
    await expect(page.getByTestId("status-selected-line")).toHaveText(`L${LINE}`);
    await page.waitForLoadState("networkidle");
    await page.getByTestId("mutants-panel").getByTestId("suggest-mutant").click();
    const drawer = page.getByTestId("suggest-mutant-drawer");
    await drawer.getByTestId("mutant-title").fill(title);
    const original = await drawer.getByTestId("mutant-original").inputValue();
    await drawer.getByTestId("mutant-mutated").fill(original.replace("1", "2"));
    await drawer.getByTestId("mutant-test-command").fill("make test-ci");
    await drawer.getByTestId("mutant-environment").fill("Debian 12, gcc 14");
    await drawer.getByTestId("mutant-submit").click();
    const href = await drawer.getByTestId("mutant-success-link").getAttribute("href");
    mutantId = Number(href!.split("/").pop());
  });

  test("reviewers are notified of the submission and the submitter of the decision", async ({
    page,
  }) => {
    // alice maintains curl/curl and should have received the submission notice.
    await signInAs(page, "alice");
    await page.getByTestId("notifications-bell").click();
    const menu = page.getByTestId("notifications-menu");
    await expect(menu.getByTestId("notification-item").first()).toContainText(
      `submitted #${mutantId}`,
    );
    await page.keyboard.press("Escape");

    await page.goto(`/review?selected=${mutantId}`);
    await page.waitForLoadState("networkidle");
    const detail = page.getByTestId("review-detail");
    await detail.getByTestId("review-comment").fill("Please add the build log.");
    await detail.getByTestId("review-action-NEEDS_INFORMATION").click();
    await expect(detail.getByTestId("review-status").first()).toHaveAttribute(
      "data-status",
      "NEEDS_INFORMATION",
    );

    await signInAs(page, submitter);
    expect(await unreadCount(page)).toBe(1);
    await page.getByTestId("notifications-bell").click();
    const item = page.getByTestId("notifications-menu").getByTestId("notification-item").first();
    await expect(item).toContainText(`@alice requested more information on #${mutantId}`);
    await expect(item).toContainText("Please add the build log.");
    await expect(item).toHaveAttribute("data-read", "false");

    // Opening the notification marks it read and navigates to the mutant.
    await item.click();
    await page.waitForURL(new RegExp(`/mutants/${mutantId}$`));
    expect(await unreadCount(page)).toBe(0);
  });

  test("comments notify the submitter and the inbox page can clear everything", async ({
    page,
  }) => {
    await signInAs(page, "erin");
    await page.goto(`/mutants/${mutantId}`);
    await page.waitForLoadState("networkidle");
    await page.getByTestId("comment-body").fill("I can reproduce this on Fedora.");
    await page.getByTestId("comment-submit").click();
    await expect(page.getByTestId("comment-item").last()).toContainText("Fedora");

    await signInAs(page, submitter);
    expect(await unreadCount(page)).toBe(1);
    await page.goto("/notifications");
    const rows = page.getByTestId("notification-row");
    await expect(rows.first()).toContainText(`@erin commented on #${mutantId}`);
    await expect(rows.first()).toHaveAttribute("data-read", "false");
    await expect(rows.nth(1)).toHaveAttribute("data-read", "true");

    await page.goto("/notifications?filter=unread");
    await expect(page.getByTestId("notification-row")).toHaveCount(1);

    await page.getByTestId("notifications-bell").click();
    await page.getByTestId("notifications-mark-all").click();
    await expect(page.getByTestId("notifications-count")).toHaveCount(0);
    await page.goto("/notifications?filter=unread");
    await expect(page.getByTestId("notification-row")).toHaveCount(0);
  });
});
