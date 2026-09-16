import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { checkAllMock } = vi.hoisted(() => ({ checkAllMock: vi.fn() }));
vi.mock("@/server/services/drift-service", () => ({ driftService: { checkAll: checkAllMock } }));

import { POST } from "@/app/api/jobs/drift/route";

function call(auth?: string) {
  return POST(
    new Request("http://localhost/api/jobs/drift", {
      method: "POST",
      headers: auth ? { authorization: auth } : {},
    }),
  );
}

describe("POST /api/jobs/drift", () => {
  beforeEach(() => {
    checkAllMock.mockReset();
    checkAllMock.mockResolvedValue([
      {
        projectId: "p",
        project: "curl/curl",
        headSha: "e8d1",
        checked: 3,
        applies: 2,
        moved: 1,
        gone: 0,
        missingFiles: [],
      },
    ]);
  });
  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("is disabled without a configured secret", async () => {
    const res = await call("Bearer anything");
    expect(res.status).toBe(503);
    expect(checkAllMock).not.toHaveBeenCalled();
  });

  it("rejects a missing or wrong bearer token", async () => {
    process.env.CRON_SECRET = "s3cret";
    expect((await call()).status).toBe(401);
    expect((await call("Bearer nope")).status).toBe(401);
    expect((await call("Basic s3cret")).status).toBe(401);
    expect(checkAllMock).not.toHaveBeenCalled();
  });

  it("runs the check for every project with the right token", async () => {
    process.env.CRON_SECRET = "s3cret";
    const res = await call("Bearer s3cret");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; results: Array<{ project: string }> };
    expect(body.ok).toBe(true);
    expect(body.results[0].project).toBe("curl/curl");
    expect(checkAllMock).toHaveBeenCalledTimes(1);
  });
});
