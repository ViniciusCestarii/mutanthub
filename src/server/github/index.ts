import "server-only";
import { env } from "@/server/env";
import { createLiveGitHubClient } from "./live-client";
import { createTokenProvider } from "./app-auth";
import { createMockGitHubClient } from "./mock-client";
import type { GitHubClient } from "./types";

export { GitHubError, isGitHubError, MAX_FILE_BYTES } from "./types";
export type {
  CommitInfo,
  FileContent,
  GitHubClient,
  GitHubErrorKind,
  RepositoryInfo,
  TreeEntry,
} from "./types";

/**
 * Process-wide client singleton. Stored on `globalThis` so the in-memory cache
 * survives Next.js hot reloads in development.
 */
const globalForGitHub = globalThis as unknown as { githubClient?: GitHubClient };

function createClient(): GitHubClient {
  return env.resolvedGithubMode === "live"
    ? createLiveGitHubClient(createTokenProvider())
    : createMockGitHubClient();
}

export function getGitHubClient(): GitHubClient {
  const existing = globalForGitHub.githubClient;
  if (existing && existing.mode === env.resolvedGithubMode) return existing;
  const client = createClient();
  globalForGitHub.githubClient = client;
  return client;
}
