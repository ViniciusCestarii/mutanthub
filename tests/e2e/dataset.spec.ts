import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

/**
 * Dataset exports: live CSV/JSON streams, per-mutant patch download, and an
 * admin publishing a frozen snapshot whose downloads carry the content hash.
 */

async function signInAs(page: Page, username: string) {
  await page.context().clearCookies();
  await page.goto("/signin");
  await page.locator("#mock-username").fill(username);
  await page.getByTestId("mock-sign-in-submit").click();
  await page.waitForURL(/\/dashboard/);
}

test.describe.configure({ mode: "serial" });

test.describe("dataset", () => {
  const name = `E2E snapshot ${Date.now()}`;
  let slug = "";

  test("live exports stream CSV and JSON with the documented columns", async ({ page }) => {
    const csv = await page.request.get("/api/export/mutants.csv?project=curl/curl&limit=5");
    expect(csv.status()).toBe(200);
    expect(csv.headers()["content-type"]).toContain("text/csv");
    const text = await csv.text();
    const lines = text.split("\r\n").filter(Boolean);
    expect(lines[0].startsWith("id,repository,language,commit,pullRequest,file,")).toBe(true);
    expect(lines.length).toBeGreaterThan(1);

    const json = await page.request.get("/api/export/mutants.json?project=curl/curl&limit=5");
    expect(json.status()).toBe(200);
    const rows = (await json.json()) as Array<Record<string, unknown>>;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(5);
    expect(rows[0].repository).toBe("curl/curl");
    expect(typeof rows[0].diff).toBe("string");

    const empty = await page.request.get("/api/export/mutants.json?project=nobody/nothing");
    expect(await empty.json()).toEqual([]);
  });

  test("a mutant's patch downloads as a patch file", async ({ page }) => {
    const first = (await (await page.request.get("/api/mutants?pageSize=1")).json()) as {
      data: Array<{ id: number }>;
    };
    const id = first.data[0].id;
    const res = await page.request.get(`/api/mutants/${id}/patch`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/x-patch");
    expect(res.headers()["content-disposition"]).toContain(`mutant-${id}.patch`);
    const body = await res.text();
    expect(body).toContain(`# MutantHub mutant #${id}`);
    expect(body).toMatch(/\n\+\+\+ b\//);
  });

  test("non-admins see no publish form; an admin publishes a snapshot", async ({ page }) => {
    await signInAs(page, "dave");
    await page.goto("/datasets");
    await expect(page.getByTestId("datasets-page")).toBeVisible();
    await expect(page.getByTestId("create-snapshot-form")).toHaveCount(0);

    await signInAs(page, "bruno");
    await page.goto("/datasets");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("snapshot-name").fill(name);
    await page.getByTestId("snapshot-project").selectOption("curl/curl");
    await page.getByTestId("snapshot-submit").click();
    await page.waitForURL(/\/datasets\/[a-z0-9-]+$/);
    slug = page.url().split("/").pop()!;

    await expect(page.getByTestId("snapshot-page")).toContainText(name);
    await expect(page.getByTestId("snapshot-filters")).toContainText("curl/curl");
  });

  test("snapshot downloads are frozen and verifiable", async ({ page }) => {
    const json = await page.request.get(`/api/datasets/${slug}/mutants.json`);
    expect(json.status()).toBe(200);
    const hash = json.headers()["x-dataset-sha256"];
    const rows = (await json.json()) as Array<Record<string, unknown>>;
    expect(rows.length).toBe(Number(json.headers()["x-dataset-rows"]));
    expect(rows.every((r) => r.repository === "curl/curl")).toBe(true);

    // Recompute the canonical hash client-side: sorted keys, one row per line, id order.
    const canonical = rows
      .slice()
      .sort((a, b) => Number(a.id) - Number(b.id))
      .map(
        (r) =>
          `${JSON.stringify(
            Object.fromEntries(
              Object.keys(r)
                .sort()
                .map((k) => [k, r[k]]),
            ),
          )}\n`,
      )
      .join("");
    expect(createHash("sha256").update(canonical).digest("hex")).toBe(hash);

    const csv = await page.request.get(`/api/datasets/${slug}/mutants.csv`);
    expect(csv.status()).toBe(200);
    expect(csv.headers()["cache-control"]).toContain("immutable");
    expect((await csv.text()).split("\r\n").filter(Boolean).length).toBe(rows.length + 1);

    await page.goto("/datasets");
    await expect(page.getByTestId("snapshot-list")).toContainText(name);
    const missing = await page.request.get("/api/datasets/does-not-exist/mutants.json");
    expect(missing.status()).toBe(404);
  });
});
