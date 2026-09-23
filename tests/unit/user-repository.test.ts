import { beforeEach, describe, expect, it, vi } from "vitest";

const { tx, prismaMock } = vi.hoisted(() => {
  const tx = {
    user: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    $executeRaw: vi.fn(),
    $executeRawUnsafe: vi.fn(),
  };
  const prismaMock = {
    user: { findUnique: vi.fn() },
    $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  return { tx, prismaMock };
});

vi.mock("@/server/db/prisma", () => ({ prisma: prismaMock }));

import { userRepository } from "@/server/repositories/user-repository";

const identity = {
  githubId: "gh-1",
  githubUsername: "bob",
  displayName: "Bob",
  avatarUrl: null,
  email: null,
};
const existing = { id: "u1", githubId: "gh-1", githubUsername: "oldname", email: "a@b.c" };

describe("upsertFromGitHub after a GitHub rename", () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockResolvedValue(existing);
    tx.user.update.mockResolvedValue({ ...existing, githubUsername: "bob" });
  });

  it("merges a placeholder holding the new name in another casing", async () => {
    tx.user.findUnique.mockResolvedValue({ id: "p1", githubId: null, globalRole: "ADMIN" });

    await userRepository.upsertFromGitHub(identity);

    for (const [sql, ...args] of tx.$executeRawUnsafe.mock.calls) {
      expect(sql).toMatch(/^UPDATE "\w+" SET "\w+" = \$1 WHERE "\w+" = \$2$/);
      expect(args).toEqual(["u1", "p1"]);
    }
    expect(tx.$executeRawUnsafe).toHaveBeenCalledTimes(14);
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: "p1" } });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: expect.objectContaining({ githubUsername: "bob", globalRole: "ADMIN" }),
    });
    expect(tx.user.delete.mock.invocationCallOrder[0]).toBeLessThan(
      tx.user.update.mock.invocationCallOrder[0],
    );
  });

  it("leaves a GitHub-linked account holding the name alone", async () => {
    tx.user.findUnique.mockResolvedValue({ id: "u2", githubId: "gh-2", globalRole: "ADMIN" });

    await userRepository.upsertFromGitHub(identity);

    expect(tx.user.delete).not.toHaveBeenCalled();
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(tx.user.update.mock.calls[0][0].data).not.toHaveProperty("globalRole");
  });

  it("does not merge when the user keeps their own name", async () => {
    tx.user.findUnique.mockResolvedValue(existing);

    await userRepository.upsertFromGitHub(identity);

    expect(tx.user.delete).not.toHaveBeenCalled();
    expect(tx.user.update).toHaveBeenCalledOnce();
  });
});
