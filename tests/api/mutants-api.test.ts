import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MutantDetail, MutantListItem } from "@/server/repositories/mutant-repository";

const { listMock, detailMock } = vi.hoisted(() => ({ listMock: vi.fn(), detailMock: vi.fn() }));

vi.mock("@/server/services/mutant-service", () => ({
  mutantService: { list: listMock, getDetail: detailMock },
}));

import { GET as listGet } from "@/app/api/mutants/route";
import { GET as detailGet } from "@/app/api/mutants/[id]/route";
import { AppError } from "@/lib/errors";
import { RATE_LIMITS, resetRateLimits } from "@/server/infra/rate-limit";

const user = {
  id: "u1",
  githubUsername: "alice",
  displayName: "Alice",
  avatarUrl: null,
  globalRole: "USER" as const,
};

function listItem(overrides: Partial<MutantListItem> = {}): MutantListItem {
  return {
    id: 182,
    title: "Off by one",
    filePath: "src/script/interpreter.cpp",
    startLine: 421,
    endLine: 421,
    mutationOperator: "RELATIONAL_OPERATOR",
    reviewStatus: "APPROVED",
    mutationStatus: "SURVIVED",
    fingerprint: "f",
    duplicateOfId: null,
    pullRequestId: null,
    driftStatus: "UNCHECKED",
    driftLine: null,
    driftCommitSha: null,
    createdAt: new Date("2026-09-01T10:00:00Z"),
    updatedAt: new Date("2026-09-03T10:00:00Z"),
    project: {
      id: "p",
      githubOwner: "bitcoin",
      githubRepository: "bitcoin",
      displayName: "bitcoin/bitcoin",
      language: "C++",
    },
    revision: { id: "r", commitSha: "abc1234567890abc1234567890abc1234567890a", branch: "master" },
    createdBy: user,
    validations: [
      { result: "SURVIVED" },
      { result: "SURVIVED" },
      { result: "SURVIVED" },
      { result: "SURVIVED" },
    ],
    _count: { comments: 2, validations: 4 },
    ...overrides,
  };
}

describe("GET /api/mutants", () => {
  beforeEach(async () => {
    listMock.mockReset();
    await resetRateLimits();
  });

  it("returns serialized mutants with pagination", async () => {
    listMock.mockResolvedValue({
      items: [listItem()],
      total: 1,
      filter: { page: 1, pageSize: 25, project: "bitcoin/bitcoin" },
    });
    const res = await listGet(
      new Request("http://localhost:3000/api/mutants?project=bitcoin/bitcoin"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(listMock).toHaveBeenCalledWith({ project: "bitcoin/bitcoin" });
    expect(body.data[0]).toMatchObject({
      id: 182,
      repository: "bitcoin/bitcoin",
      commit: "abc1234567890abc1234567890abc1234567890a",
      file: "src/script/interpreter.cpp",
      startLine: 421,
      reviewStatus: "APPROVED",
      mutationStatus: "SURVIVED",
      reproductions: 4,
      url: "http://localhost:3000/mutants/182",
    });
    expect(body.pagination).toEqual({ page: 1, pageSize: 25, total: 1, totalPages: 1 });
    expect(res.headers.get("X-RateLimit-Remaining")).toBe(String(RATE_LIMITS.api.limit - 1));
  });

  it("returns 429 when the per-IP limit is exhausted", async () => {
    listMock.mockResolvedValue({ items: [], total: 0, filter: { page: 1, pageSize: 25 } });
    const request = () =>
      listGet(
        new Request("http://localhost:3000/api/mutants", {
          headers: { "x-forwarded-for": "10.0.0.1" },
        }),
      );
    for (let i = 0; i < RATE_LIMITS.api.limit; i += 1) {
      expect((await request()).status).toBe(200);
    }
    expect((await request()).status).toBe(429);
    // Other clients are unaffected.
    const other = await listGet(
      new Request("http://localhost:3000/api/mutants", {
        headers: { "x-forwarded-for": "10.0.0.2" },
      }),
    );
    expect(other.status).toBe(200);
  });
});

describe("GET /api/mutants/:id", () => {
  beforeEach(async () => {
    detailMock.mockReset();
    await resetRateLimits();
  });

  it("rejects invalid ids", async () => {
    const res = await detailGet(new Request("http://localhost:3000/api/mutants/abc"), {
      params: Promise.resolve({ id: "abc" }),
    });
    expect(res.status).toBe(400);
  });

  it("maps NOT_FOUND to 404", async () => {
    detailMock.mockImplementation(async () => {
      throw new AppError("NOT_FOUND", "Mutant not found");
    });
    const res = await detailGet(new Request("http://localhost:3000/api/mutants/999"), {
      params: Promise.resolve({ id: "999" }),
    });
    expect(res.status).toBe(404);
    expect((await res.json()).error.message).toBe("Mutant not found");
  });

  it("returns the full record with diff, evidence and history", async () => {
    const base = listItem();
    const now = new Date();
    const detail = {
      ...base,
      projectId: "p",
      revisionId: "r",
      originalCode: "a > b",
      mutatedCode: "a >= b",
      gitDiff: "-a > b\n+a >= b\n",
      description: null,
      createdById: user.id,
      project: {
        ...base.project,
        githubRepositoryId: "1",
        description: null,
        defaultBranch: "master",
        isActive: true,
        addedById: null,
        createdAt: now,
        updatedAt: now,
      },
      revision: {
        ...base.revision,
        projectId: "p",
        commitMessage: null,
        author: null,
        commitDate: null,
        createdAt: now,
      },
      duplicateOf: null,
      duplicates: [],
      submissions: [
        {
          id: "s1",
          mutantId: 182,
          submittedById: user.id,
          submittedBy: user,
          buildCommand: "make",
          testCommand: "make test",
          fuzzCommand: null,
          testDurationSeconds: 60,
          environmentDescription: "Ubuntu",
          operatingSystem: "Linux",
          compiler: "gcc",
          observedResult: "SURVIVED",
          notes: null,
          stdout: null,
          stderr: null,
          createdAt: now,
        },
      ],
      validations: [
        {
          id: "v1",
          mutantId: 182,
          userId: user.id,
          user,
          result: "SURVIVED",
          command: null,
          environment: null,
          notes: null,
          createdAt: now,
        },
      ],
      comments: [],
      statusHistory: [
        {
          id: "h1",
          mutantId: 182,
          changedById: user.id,
          changedBy: user,
          kind: "REVIEW",
          previousValue: "PENDING",
          newValue: "APPROVED",
          comment: null,
          createdAt: now,
        },
      ],
    } as unknown as MutantDetail;
    detailMock.mockResolvedValue({ mutant: detail });
    const res = await detailGet(new Request("http://localhost:3000/api/mutants/182"), {
      params: Promise.resolve({ id: "182" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.diff).toContain("+a >= b");
    expect(body.data.submissions[0].testCommand).toBe("make test");
    expect(body.data.history[0]).toMatchObject({
      kind: "REVIEW",
      from: "PENDING",
      to: "APPROVED",
      changedBy: "alice",
    });
    expect(body.data.reproductions).toBe(1);
  });
});
