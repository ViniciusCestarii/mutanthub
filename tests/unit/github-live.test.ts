import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GitHubTokenProvider } from "@/server/github/app-auth";

/**
 * Live client credential handling: user token first, one retry with server
 * credentials when GitHub rejects the user token, and a user-facing message
 * when the user's own quota is exhausted.
 */

function provider(user: string | undefined, server: string | undefined) {
  let current = user;
  const p: GitHubTokenProvider & { rejected: string[] } = {
    rejected: [],
    getToken: async () => current ?? server,
    describe: async () => (server ? "token" : "anonymous"),
    isUserToken: async (token) => token === user,
    fallbackFor: async (token) => {
      if (token !== user) return null;
      p.rejected.push(token);
      current = undefined;
      return { token: server };
    },
  };
  return p;
}

function repoJson(name: string) {
  return JSON.stringify({
    id: 1,
    name,
    full_name: `o/${name}`,
    owner: { login: "o" },
    description: null,
    default_branch: "main",
    language: "C",
    html_url: "https://github.com/o/x",
    private: false,
    archived: false,
  });
}

beforeEach(() => {
  delete process.env.REDIS_URL;
});
afterEach(() => vi.unstubAllGlobals());

describe("live client credentials", () => {
  it("sends the user token and retries once with the server token after a 401", async () => {
    const auths: Array<string | null> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const auth = (init?.headers as Record<string, string>)?.Authorization ?? null;
        auths.push(auth);
        if (auth === "Bearer gho_user") {
          return new Response(JSON.stringify({ message: "Bad credentials" }), { status: 401 });
        }
        if (url.includes("/commits/")) {
          return new Response(
            JSON.stringify({
              sha: "a".repeat(40),
              html_url: "https://github.com/o/retry/commit/a",
              commit: { message: "m", author: { name: "n", date: "2026-01-01T00:00:00Z" } },
              author: { login: "n" },
            }),
            { status: 200 },
          );
        }
        return new Response(repoJson("retry"), { status: 200 });
      }),
    );
    const { createLiveGitHubClient } = await import("@/server/github/live-client");
    const p = provider("gho_user", "ghp_server");
    const client = createLiveGitHubClient(p);

    const repo = await client.getRepository("o", "retry");
    expect(repo.name).toBe("retry");
    expect(auths).toEqual(["Bearer gho_user", "Bearer ghp_server"]);
    expect(p.rejected).toEqual(["gho_user"]);
    // The provider now skips the rejected token: no further 401 round-trips.
    await client.getCommit("o", "retry", "main");
    expect(auths.at(-1)).toBe("Bearer ghp_server");
  });

  it("does not retry when the server credential itself is rejected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify({ message: "Bad credentials" }), { status: 401 }),
      ),
    );
    const { createLiveGitHubClient } = await import("@/server/github/live-client");
    const client = createLiveGitHubClient(provider(undefined, "ghp_server"));
    await expect(client.getRepository("o", "server-401")).rejects.toMatchObject({
      kind: "UNAUTHORIZED",
    });
    expect((fetch as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(1);
  });

  it("explains an exhausted user quota", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ message: "API rate limit exceeded" }), {
            status: 403,
            headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1893456000" },
          }),
      ),
    );
    const { createLiveGitHubClient } = await import("@/server/github/live-client");
    const client = createLiveGitHubClient(provider("gho_user", "ghp_server"));
    await expect(client.getRepository("o", "quota")).rejects.toMatchObject({
      kind: "RATE_LIMITED",
      message: expect.stringMatching(/Your GitHub API quota is used up/),
    });
  });
});
