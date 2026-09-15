import "server-only";
import { defaultTtlMs, getOrSet } from "./cache";
import type { GitHubTokenProvider } from "./app-auth";
import { changedRangesFromPatch } from "@/domain/pull-requests/diff-ranges";
import {
  GitHubError,
  MAX_FILE_BYTES,
  type CommitInfo,
  type FileContent,
  type GitHubClient,
  type PullRequestFile,
  type PullRequestInfo,
  type RepositoryInfo,
  type TreeEntry,
} from "./types";

const API_BASE = "https://api.github.com";
const IMMUTABLE_TTL_MS = 24 * 60 * 60 * 1000;
const FULL_SHA = /^[0-9a-f]{40}$/i;

/** Shapes of the GitHub REST payloads we consume (only the fields we read). */
interface RepoPayload {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  description: string | null;
  default_branch: string;
  language: string | null;
  html_url: string;
  private: boolean;
  archived: boolean;
}

interface CommitPayload {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: { name: string | null; date: string | null } | null;
  };
  author: { login: string } | null;
}

interface ContentEntryPayload {
  name: string;
  path: string;
  type: "file" | "dir" | "symlink" | "submodule";
  size: number;
  sha: string;
  html_url: string | null;
  encoding?: string;
  content?: string;
}

interface PullPayload {
  number: number;
  title: string;
  user: { login: string } | null;
  state: "open" | "closed";
  merged_at: string | null;
  merge_commit_sha: string | null;
  html_url: string;
  changed_files: number;
  additions: number;
  deletions: number;
  base: { ref: string; sha: string };
  head: { ref: string; sha: string };
}

interface PullFilePayload {
  filename: string;
  status: PullRequestFile["status"];
  additions: number;
  deletions: number;
  patch?: string;
}

const PR_TTL_MS = 60 * 1000;

async function request<T>(url: string, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "MutantHub",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(url, { headers });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    throw new GitHubError("NETWORK", `Could not reach GitHub: ${reason}`);
  }

  if (!response.ok) {
    throw await toGitHubError(response);
  }
  return (await response.json()) as T;
}

async function toGitHubError(response: Response): Promise<GitHubError> {
  const status = response.status;
  let message = `GitHub API responded with ${status}`;
  try {
    const body = (await response.json()) as { message?: string };
    if (body.message) message = body.message;
  } catch {
    // Non-JSON error body; keep the generic message.
  }

  if (status === 404) return new GitHubError("NOT_FOUND", message);
  if (status === 401) return new GitHubError("UNAUTHORIZED", message);
  if (status === 403 || status === 429) {
    const remaining = response.headers.get("x-ratelimit-remaining");
    const rateLimited = remaining === "0" || /rate limit/i.test(message) || status === 429;
    if (rateLimited) {
      const reset = response.headers.get("x-ratelimit-reset");
      const resetAt = reset ? new Date(Number(reset) * 1000) : null;
      return new GitHubError("RATE_LIMITED", message, resetAt);
    }
    return new GitHubError("UNAUTHORIZED", message);
  }
  if (status >= 500) return new GitHubError("UNAVAILABLE", message);
  return new GitHubError("INVALID", message);
}

function encodePath(path: string): string {
  return path
    .split("/")
    .filter((segment) => segment.length > 0)
    .map(encodeURIComponent)
    .join("/");
}

function sortEntries(entries: TreeEntry[]): TreeEntry[] {
  const rank = (entry: TreeEntry) => (entry.type === "dir" ? 0 : 1);
  return [...entries].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

function ttlFor(ref: string): number {
  return FULL_SHA.test(ref) ? IMMUTABLE_TTL_MS : defaultTtlMs();
}

function decodeFile(payload: ContentEntryPayload, path: string): FileContent {
  const base: Omit<FileContent, "content" | "tooLarge" | "binary"> = {
    path,
    sha: payload.sha,
    size: payload.size,
    htmlUrl: payload.html_url ?? "",
  };
  if (payload.size > MAX_FILE_BYTES || payload.encoding !== "base64" || payload.content == null) {
    return { ...base, content: null, tooLarge: true, binary: false };
  }
  const buffer = Buffer.from(payload.content, "base64");
  if (buffer.includes(0)) {
    return { ...base, content: null, tooLarge: false, binary: true };
  }
  return { ...base, content: buffer.toString("utf8"), tooLarge: false, binary: false };
}

export function createLiveGitHubClient(auth: GitHubTokenProvider): GitHubClient {
  const repoUrl = (owner: string, repo: string) =>
    `${API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  return {
    mode: "live",

    getRepository(owner, repo): Promise<RepositoryInfo> {
      return getOrSet(`gh:repo:${owner}/${repo}`, defaultTtlMs(), async () => {
        const data = await request<RepoPayload>(
          repoUrl(owner, repo),
          await auth.getToken(owner, repo),
        );
        return {
          id: String(data.id),
          owner: data.owner.login,
          name: data.name,
          fullName: data.full_name,
          description: data.description,
          defaultBranch: data.default_branch,
          language: data.language,
          htmlUrl: data.html_url,
          isPrivate: data.private,
          isArchived: data.archived,
        };
      });
    },

    getCommit(owner, repo, ref): Promise<CommitInfo> {
      return getOrSet(`gh:commit:${owner}/${repo}:${ref}`, ttlFor(ref), async () => {
        const data = await request<CommitPayload>(
          `${repoUrl(owner, repo)}/commits/${encodeURIComponent(ref)}`,
          await auth.getToken(owner, repo),
        );
        const date = data.commit.author?.date ? new Date(data.commit.author.date) : null;
        return {
          sha: data.sha,
          message: data.commit.message,
          authorName: data.commit.author?.name ?? null,
          authorLogin: data.author?.login ?? null,
          date,
          htmlUrl: data.html_url,
        };
      });
    },

    getTree(owner, repo, ref, path): Promise<TreeEntry[]> {
      return getOrSet(`gh:tree:${owner}/${repo}:${ref}:${path}`, ttlFor(ref), async () => {
        const url = `${repoUrl(owner, repo)}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`;
        const data = await request<ContentEntryPayload[] | ContentEntryPayload>(
          url,
          await auth.getToken(owner, repo),
        );
        if (!Array.isArray(data)) {
          throw new GitHubError("INVALID", `${path || "/"} is not a directory`);
        }
        return sortEntries(
          data.map((entry) => ({
            name: entry.name,
            path: entry.path,
            type: entry.type,
            size: entry.type === "file" ? entry.size : null,
          })),
        );
      });
    },

    getFile(owner, repo, ref, path): Promise<FileContent> {
      return getOrSet(`gh:file:${owner}/${repo}:${ref}:${path}`, ttlFor(ref), async () => {
        const url = `${repoUrl(owner, repo)}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`;
        const data = await request<ContentEntryPayload[] | ContentEntryPayload>(
          url,
          await auth.getToken(owner, repo),
        );
        if (Array.isArray(data)) {
          throw new GitHubError("INVALID", `${path} is a directory`);
        }
        if (data.type !== "file") {
          throw new GitHubError("INVALID", `${path} is not a regular file`);
        }
        return decodeFile(data, path);
      });
    },

    getPullRequest(owner, repo, number): Promise<PullRequestInfo> {
      return getOrSet(`gh:pull:${owner}/${repo}:${number}`, PR_TTL_MS, async () => {
        const data = await request<PullPayload>(
          `${repoUrl(owner, repo)}/pulls/${number}`,
          await auth.getToken(owner, repo),
        );
        return {
          number: data.number,
          title: data.title,
          authorLogin: data.user?.login ?? null,
          state: data.merged_at ? "MERGED" : data.state === "open" ? "OPEN" : "CLOSED",
          baseRef: data.base.ref,
          baseSha: data.base.sha,
          headRef: data.head.ref,
          headSha: data.head.sha,
          mergeCommitSha: data.merged_at ? data.merge_commit_sha : null,
          htmlUrl: data.html_url,
          changedFiles: data.changed_files,
          additions: data.additions,
          deletions: data.deletions,
        };
      });
    },

    getPullRequestFiles(owner, repo, number): Promise<PullRequestFile[]> {
      return getOrSet(`gh:pull-files:${owner}/${repo}:${number}`, PR_TTL_MS, async () => {
        const token = await auth.getToken(owner, repo);
        const files: PullRequestFile[] = [];
        for (let page = 1; page <= 30; page += 1) {
          const batch = await request<PullFilePayload[]>(
            `${repoUrl(owner, repo)}/pulls/${number}/files?per_page=100&page=${page}`,
            token,
          );
          for (const f of batch) {
            files.push({
              path: f.filename,
              status: f.status,
              additions: f.additions,
              deletions: f.deletions,
              changedRanges: f.status === "removed" ? [] : changedRangesFromPatch(f.patch),
            });
          }
          if (batch.length < 100) break;
        }
        return files;
      });
    },
  };
}
