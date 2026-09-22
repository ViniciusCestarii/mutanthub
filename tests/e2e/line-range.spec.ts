import { expect, test, type Page } from "@playwright/test";

/**
 * Multi-line selection: dragging over the viewer selects a block (#L116-L118),
 * the drawer submits that block, and following the mutant's link from the list
 * brings the block back selected — the client-side navigation case, where the
 * page commits before the URL carries its hash.
 */

const FILE_URL = "/projects/curl/curl/code/lib/url.c";
const START = 116;
const END = 118;

async function signInAs(page: Page, username: string) {
  await page.context().clearCookies();
  await page.goto("/signin");
  await page.getByTestId(`mock-user-${username}`).click();
  await page.getByTestId("mock-sign-in-submit").click();
  await page.waitForURL(/\/dashboard/);
}

/** Vertical centre of a line, read from its number in the margin. */
async function lineY(page: Page, line: number): Promise<number> {
  const number = page
    .locator(".margin-view-overlays .line-numbers")
    .filter({ hasText: new RegExp(`^${line}$`) })
    .first();
  await expect(number).toBeVisible();
  const box = await number.boundingBox();
  if (!box) throw new Error(`line ${line} has no box`);
  return box.y + box.height / 2;
}

async function dragLines(page: Page, from: number, to: number) {
  const content = await page.locator(".monaco-editor .lines-content").first().boundingBox();
  if (!content) throw new Error("editor has no box");
  const x = content.x + 40;
  const fromY = await lineY(page, from);
  const toY = await lineY(page, to);
  await page.mouse.move(x, fromY);
  await page.mouse.down();
  // In slices, as a hand does: each intermediate selection is reported, and a
  // burst of URL writes must not leave the hash on the line the drag started.
  for (let step = 1; step <= 6; step++) {
    await page.mouse.move(x + step * 10, fromY + ((toY - fromY) * step) / 6);
    await page.waitForTimeout(50);
  }
  await page.mouse.up();
}

test.describe.configure({ mode: "serial" });

test.describe("multi-line selection", () => {
  const title = `Range e2e ${Date.now()}`;
  let mutantId: number;

  test("dragging over the viewer selects the whole block", async ({ page }) => {
    await signInAs(page, "frank");
    // Monaco only renders the lines around the viewport, so open at the block.
    await page.goto(`${FILE_URL}#L${START}`);
    await expect(page.getByTestId("code-viewer").first()).toBeVisible();
    await page.waitForLoadState("networkidle");

    await dragLines(page, START, END);

    await expect(page).toHaveURL(new RegExp(`#L${START}-L${END}$`));
    await expect(page.locator('[data-testid="status-selected-line"]:visible')).toHaveText(
      `L${START}`,
    );
    await expect(page.getByTestId("selected-line-text")).toContainText("value = value * 10");
    await expect(page.getByTestId("selected-line-text")).toContainText("CURLUE_BAD_PORT_NUMBER");
    await expect(page.getByTestId("mutants-panel").getByTestId("suggest-mutant")).toContainText(
      `L${START}–L${END}`,
    );
  });

  test("the drawer submits the dragged block", async ({ page }) => {
    await signInAs(page, "frank");
    await page.goto(`${FILE_URL}#L${START}-L${END}`);
    await page.waitForLoadState("networkidle");
    await page.getByTestId("mutants-panel").getByTestId("suggest-mutant").click();

    const drawer = page.getByTestId("suggest-mutant-drawer");
    await expect(drawer.locator("#endLine")).toHaveValue(String(END));
    // The original code is the file's own lines, never typed by the contributor.
    await expect(drawer.getByTestId("mutant-original")).toHaveValue(/value = value \* 10/);
    await expect(drawer.getByTestId("mutant-original")).toHaveValue(/CURLUE_BAD_PORT_NUMBER/);

    await drawer.getByTestId("mutant-title").fill(title);
    await drawer
      .getByTestId("mutant-mutated")
      .fill(
        "    value = value * 100 + (unsigned long)(*p - '0');\n    if(value > MAX_PORT)\n      return CURLUE_BAD_PORT_NUMBER;",
      );
    await drawer.getByTestId("mutant-test-command").fill("make test-ci");
    await drawer.getByTestId("mutant-submit").click();
    const href = await drawer.getByTestId("mutant-success-link").getAttribute("href");
    mutantId = Number(href!.split("/").pop());
    expect(mutantId).toBeGreaterThan(0);
  });

  test("the list links back to the range and arrives selected", async ({ page }) => {
    await signInAs(page, "frank");
    await page.goto("/projects/curl/curl/mutants?file=lib/url.c");
    const row = page.locator(`[data-testid="mutant-row"][data-mutant-id="${mutantId}"]`);
    await expect(row).toBeVisible();
    const fileLink = row.locator(`a[href*="${FILE_URL}"]`).first();
    await expect(fileLink).toContainText(`:${START}–${END}`);

    await fileLink.click();
    await expect(page).toHaveURL(new RegExp(`#L${START}-L${END}$`));
    await expect(page.getByTestId("mutants-panel").getByTestId("suggest-mutant")).toContainText(
      `L${START}–L${END}`,
    );
    // The block is selected in the editor, not only recorded in the URL.
    await expect(page.locator(".mh-line-selected").first()).toBeVisible();
  });

  test("clicking the mutant in the panel selects its whole range", async ({ page }) => {
    await signInAs(page, "frank");
    await page.goto(`${FILE_URL}#L1`);
    await page.waitForLoadState("networkidle");
    await page
      .getByTestId("mutants-panel")
      .locator(`[data-testid="panel-mutant"][data-mutant-id="${mutantId}"]`)
      .last()
      .getByTitle("Jump to line")
      .click();

    await expect(page).toHaveURL(new RegExp(`#L${START}-L${END}$`));
    await expect(page.getByTestId("mutants-panel").getByTestId("suggest-mutant")).toContainText(
      `L${START}–L${END}`,
    );
  });
});
