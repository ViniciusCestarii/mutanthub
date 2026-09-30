import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { backfillMock } = vi.hoisted(() => ({ backfillMock: vi.fn() }));
vi.mock("@/server/services/similarity", () => ({ backfillSimilarityKeys: backfillMock }));

import { POST } from "@/app/api/jobs/similarity/route";

function call(auth?: string) {
  return POST(
    new Request("http://localhost/api/jobs/similarity", {
      method: "POST",
      headers: auth ? { authorization: auth } : {},
    }),
  );
}

describe("POST /api/jobs/similarity", () => {
  beforeEach(() => {
    backfillMock.mockReset();
    backfillMock.mockResolvedValue({ updated: 4, unreadable: 1, remaining: 0, rateLimited: false });
  });
  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("is disabled without a configured secret and rejects a wrong token", async () => {
    expect((await call("Bearer anything")).status).toBe(503);
    process.env.CRON_SECRET = "s3cret";
    expect((await call()).status).toBe(401);
    expect((await call("Bearer nope")).status).toBe(401);
    expect(backfillMock).not.toHaveBeenCalled();
  });

  it("runs the backfill and reports what is left", async () => {
    process.env.CRON_SECRET = "s3cret";
    const res = await call("Bearer s3cret");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, updated: 4, unreadable: 1, remaining: 0 });
    expect(backfillMock).toHaveBeenCalledTimes(1);
  });
});
