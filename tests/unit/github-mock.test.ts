import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createMockGitHubClient } from "@/server/github/mock-client";
import { getMockRepo, headCommit } from "@/server/github/fixtures/manifest";
import { isGitHubError } from "@/server/github/types";

describe("mock GitHub client", () => {
  const client = createMockGitHubClient();
  const bitcoin = getMockRepo("bitcoin", "bitcoin")!;
  const head = headCommit(bitcoin);

  it("lists the root tree of bitcoin/bitcoin", async () => {
    const tree = await client.getTree("bitcoin", "bitcoin", head.sha, "");
    const names = tree.map((e) => e.name);
    expect(names).toContain("src");
    expect(names).toContain("README.md");
    expect(tree.find((e) => e.name === "src")?.type).toBe("dir");
    // Directories are listed before files.
    expect(tree[0].type).toBe("dir");
  });

  it("reads a fixture file with content", async () => {
    const file = await client.getFile("bitcoin", "bitcoin", head.sha, "src/script/interpreter.cpp");
    expect(file.content).not.toBeNull();
    expect(file.content).toContain("CheckMinimalPush");
    expect(file.tooLarge).toBe(false);
    expect(file.binary).toBe(false);
    expect(file.size).toBeGreaterThan(0);
  });

  it("resolves the default branch and a short SHA prefix to the newer commit", async () => {
    const byBranch = await client.getCommit("bitcoin", "bitcoin", bitcoin.info.defaultBranch);
    expect(byBranch.sha).toBe(head.sha);

    const byPrefix = await client.getCommit("bitcoin", "bitcoin", head.sha.slice(0, 7));
    expect(byPrefix.sha).toBe(head.sha);

    const older = bitcoin.commits[0];
    const byOlderPrefix = await client.getCommit("bitcoin", "bitcoin", older.sha.slice(0, 7));
    expect(byOlderPrefix.sha).toBe(older.sha);
  });

  it("serves a commit's own copy of a file and the head snapshot elsewhere", async () => {
    const curl = getMockRepo("curl", "curl")!;
    const older = await client.getFile("curl", "curl", curl.commits[0].sha, "lib/url.c");
    const newer = await client.getFile("curl", "curl", headCommit(curl).sha, "lib/url.c");
    expect(older.content).toContain("digits >= MAX_PORT_DIGITS");
    expect(newer.content).toContain("digits > 5");
    expect(newer.content).not.toContain("MAX_PORT_DIGITS");

    // A file without an overlay reads the same at both commits.
    const oldParse = await client.getFile("curl", "curl", curl.commits[0].sha, "lib/parsedate.c");
    const newParse = await client.getFile("curl", "curl", headCommit(curl).sha, "lib/parsedate.c");
    expect(oldParse.content).toBe(newParse.content);
  });

  it("throws NOT_FOUND for unknown repositories, refs and paths", async () => {
    await expect(client.getRepository("nobody", "nothing")).rejects.toSatisfy(
      (e: unknown) => isGitHubError(e) && e.kind === "NOT_FOUND",
    );
    await expect(client.getCommit("bitcoin", "bitcoin", "deadbeef")).rejects.toSatisfy(
      (e: unknown) => isGitHubError(e) && e.kind === "NOT_FOUND",
    );
    await expect(
      client.getFile("bitcoin", "bitcoin", head.sha, "src/missing.cpp"),
    ).rejects.toSatisfy((e: unknown) => isGitHubError(e) && e.kind === "NOT_FOUND");
    await expect(
      client.getFile("bitcoin", "bitcoin", head.sha, "../../manifest.ts"),
    ).rejects.toSatisfy((e: unknown) => isGitHubError(e) && e.kind === "NOT_FOUND");
  });
});
