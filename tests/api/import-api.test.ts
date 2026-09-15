import { beforeEach, describe, expect, it, vi } from "vitest";

const { userMock, dryRunMock, commitMock } = vi.hoisted(() => ({
  userMock: vi.fn(),
  dryRunMock: vi.fn(),
  commitMock: vi.fn(),
}));

vi.mock("@/server/auth/session", () => ({ getCurrentUser: userMock }));
vi.mock("@/server/services/project-service", () => ({
  projectService: {
    getBySlugOrThrow: vi.fn(async () => ({
      id: "p",
      githubOwner: "curl",
      githubRepository: "curl",
    })),
  },
}));
vi.mock("@/server/services/import-service", () => ({
  importService: { dryRun: dryRunMock, commit: commitMock },
}));

import { POST } from "@/app/api/projects/[owner]/[repo]/import/route";
import { forbidden } from "@/lib/errors";

const params = Promise.resolve({ owner: "curl", repo: "curl" });
const admin = {
  id: "u1",
  githubUsername: "bruno",
  displayName: "Bruno",
  avatarUrl: null,
  globalRole: "ADMIN" as const,
};

function upload(mode: string, headers: Record<string, string> = {}, body = "[]") {
  const form = new FormData();
  form.set("file", new File([body], "mutants.json", { type: "application/json" }));
  form.set("mode", mode);
  return new Request("http://localhost:3000/api/projects/curl/curl/import", {
    method: "POST",
    body: form,
    headers: { origin: "http://localhost:3000", "sec-fetch-site": "same-origin", ...headers },
  });
}

describe("POST /api/projects/:owner/:repo/import", () => {
  beforeEach(() => {
    userMock.mockReset();
    dryRunMock.mockReset();
    commitMock.mockReset();
  });

  it("refuses cross-site requests before touching the session", async () => {
    const res = await POST(
      upload("dry-run", { origin: "https://evil.example", "sec-fetch-site": "cross-site" }),
      { params },
    );
    expect(res.status).toBe(403);
    expect(userMock).not.toHaveBeenCalled();
  });

  it("requires a signed-in user", async () => {
    userMock.mockResolvedValue(null);
    const res = await POST(upload("dry-run"), { params });
    expect(res.status).toBe(401);
  });

  it("surfaces the service's authorization error for non-admins", async () => {
    userMock.mockResolvedValue({ ...admin, globalRole: "USER" });
    dryRunMock.mockImplementation(async () => {
      throw forbidden("Only administrators can import mutants");
    });
    const res = await POST(upload("dry-run"), { params });
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: string }).error).toMatch(/administrators/);
  });

  it("runs a dry run by default and commits only when asked", async () => {
    userMock.mockResolvedValue(admin);
    const report = {
      toolName: "mull",
      toolVersion: null,
      fileName: "mutants.json",
      total: 1,
      valid: 1,
      errors: [],
      duplicates: [],
      commits: [],
    };
    dryRunMock.mockResolvedValue({ report });
    commitMock.mockResolvedValue({ batch: { id: "b1" }, createdIds: [7], report });

    const dry = await POST(upload("dry-run"), { params });
    expect(dry.status).toBe(200);
    expect(await dry.json()).toEqual({ ok: true, report });
    expect(commitMock).not.toHaveBeenCalled();

    const commit = await POST(upload("commit"), { params });
    expect(await commit.json()).toEqual({ ok: true, batchId: "b1", created: 1, report });
    expect(commitMock).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({ id: "p" }),
      "[]",
      "mutants.json",
      {
        toolName: undefined,
        toolVersion: undefined,
      },
    );
  });

  it("rejects requests without a file", async () => {
    userMock.mockResolvedValue(admin);
    const form = new FormData();
    form.set("mode", "commit");
    const res = await POST(
      new Request("http://localhost:3000/api/projects/curl/curl/import", {
        method: "POST",
        body: form,
      }),
      { params },
    );
    expect(res.status).toBe(400);
    expect(commitMock).not.toHaveBeenCalled();
  });
});
