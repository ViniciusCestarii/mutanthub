import "server-only";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  getMockRepo,
  headCommit,
  type MockCommit,
  type MockPullRequest,
  type MockRepo,
} from "./fixtures/manifest";
import {
  GitHubError,
  type PullRequestFile,
  type PullRequestInfo,
  MAX_FILE_BYTES,
  type CommitInfo,
  type FileContent,
  type GitHubClient,
  type RepositoryInfo,
  type TreeEntry,
} from "./types";

/**
 * Fixture-backed client used when no GitHub token is configured (and in E2E
 * tests). Repositories are directories under `fixtures/repos/<owner>/<repo>`.
 * Both commits of a repository serve the same snapshot of files.
 */
const FIXTURES_ROOT = path.join(process.cwd(), "src", "server", "github", "fixtures", "repos");
const MIN_PREFIX = 7;

function requireRepo(owner: string, repo: string): MockRepo {
  const mock = getMockRepo(owner, repo);
  if (!mock) throw new GitHubError("NOT_FOUND", `Repository ${owner}/${repo} not found`);
  return mock;
}

function resolveRef(mock: MockRepo, ref: string): MockCommit {
  const needle = ref.trim();
  if (needle === mock.info.defaultBranch || needle === "HEAD") return headCommit(mock);
  const lower = needle.toLowerCase();
  if (lower.length >= MIN_PREFIX) {
    const matches = mock.commits.filter((c) => c.sha.startsWith(lower));
    if (matches.length === 1) return matches[0];
  }
  throw new GitHubError(
    "NOT_FOUND",
    `Commit or branch "${ref}" not found in ${mock.info.fullName}`,
  );
}

/** Rejects path traversal and returns the absolute path inside the fixture tree. */
function safeJoin(mock: MockRepo, relativePath: string): string {
  const repoRoot = path.join(FIXTURES_ROOT, mock.info.owner, mock.info.name);
  const cleaned = relativePath.replace(/^\/+/, "");
  const resolved = path.resolve(repoRoot, cleaned);
  if (resolved !== repoRoot && !resolved.startsWith(repoRoot + path.sep)) {
    throw new GitHubError("NOT_FOUND", `Path "${relativePath}" not found`);
  }
  return resolved;
}

function normalizeRelative(relativePath: string): string {
  return relativePath.replace(/^\/+/, "").replace(/\/+$/, "");
}

function toCommitInfo(commit: MockCommit): CommitInfo {
  return { ...commit };
}

export function createMockGitHubClient(): GitHubClient {
  return {
    mode: "mock",

    async getRepository(owner, repo): Promise<RepositoryInfo> {
      return { ...requireRepo(owner, repo).info };
    },

    async getCommit(owner, repo, ref): Promise<CommitInfo> {
      return toCommitInfo(resolveRef(requireRepo(owner, repo), ref));
    },

    async getTree(owner, repo, ref, dirPath): Promise<TreeEntry[]> {
      const mock = requireRepo(owner, repo);
      resolveRef(mock, ref);
      const relative = normalizeRelative(dirPath);
      const absolute = safeJoin(mock, relative);

      let names: string[];
      try {
        const info = await stat(absolute);
        if (!info.isDirectory()) throw new GitHubError("INVALID", `${relative} is not a directory`);
        names = await readdir(absolute);
      } catch (error) {
        if (error instanceof GitHubError) throw error;
        throw new GitHubError("NOT_FOUND", `Path "${relative || "/"}" not found`);
      }

      const entries = await Promise.all(
        names.map(async (name): Promise<TreeEntry> => {
          const info = await stat(path.join(absolute, name));
          const entryPath = relative ? `${relative}/${name}` : name;
          return info.isDirectory()
            ? { name, path: entryPath, type: "dir", size: null }
            : { name, path: entryPath, type: "file", size: info.size };
        }),
      );
      const rank = (entry: TreeEntry) => (entry.type === "dir" ? 0 : 1);
      return entries.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
    },

    async getFile(owner, repo, ref, filePath): Promise<FileContent> {
      const mock = requireRepo(owner, repo);
      const commit = resolveRef(mock, ref);
      const relative = normalizeRelative(filePath);
      const absolute = safeJoin(mock, relative);

      let buffer: Buffer;
      try {
        const info = await stat(absolute);
        if (!info.isFile()) throw new GitHubError("INVALID", `${relative} is not a regular file`);
        buffer = await readFile(absolute);
      } catch (error) {
        if (error instanceof GitHubError) throw error;
        throw new GitHubError("NOT_FOUND", `File "${relative}" not found`);
      }

      const base = {
        path: relative,
        // Fixture blobs have no real object id; derive a stable pseudo-sha from commit + path.
        sha: `${commit.sha.slice(0, 20)}${Buffer.from(relative).toString("hex").slice(0, 20)}`.padEnd(
          40,
          "0",
        ),
        size: buffer.length,
        htmlUrl: `${mock.info.htmlUrl}/blob/${commit.sha}/${relative}`,
      };
      if (buffer.length > MAX_FILE_BYTES) {
        return { ...base, content: null, tooLarge: true, binary: false };
      }
      if (buffer.includes(0)) {
        return { ...base, content: null, tooLarge: false, binary: true };
      }
      return { ...base, content: buffer.toString("utf8"), tooLarge: false, binary: false };
    },

    async getPullRequest(owner, repo, number): Promise<PullRequestInfo> {
      const mock = requireRepo(owner, repo);
      return toPullRequestInfo(mock, requirePull(mock, number));
    },

    async getPullRequestFiles(owner, repo, number): Promise<PullRequestFile[]> {
      const mock = requireRepo(owner, repo);
      return requirePull(mock, number).files.map((f) => ({
        path: f.path,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        changedRanges: f.changedRanges.map(([a, b]) => [a, b] as [number, number]),
      }));
    },
  };
}

function requirePull(mock: MockRepo, number: number): MockPullRequest {
  const pull = mock.pullRequests.find((p) => p.number === number);
  if (!pull) throw new GitHubError("NOT_FOUND", `Pull request #${number} not found`);
  return pull;
}

/** Fixture PRs go from the older commit (base) to the newer one (head). */
function toPullRequestInfo(mock: MockRepo, pull: MockPullRequest): PullRequestInfo {
  const base = mock.commits[0];
  const head = headCommit(mock);
  return {
    number: pull.number,
    title: pull.title,
    authorLogin: pull.authorLogin,
    state: pull.state,
    baseRef: mock.info.defaultBranch,
    baseSha: base.sha,
    headRef: pull.headRef,
    headSha: head.sha,
    // Fixture PRs merge into the newer commit, so it doubles as the merge commit.
    mergeCommitSha: pull.state === "MERGED" ? head.sha : null,
    htmlUrl: `${mock.info.htmlUrl}/pull/${pull.number}`,
    changedFiles: pull.files.length,
    additions: pull.files.reduce((n, f) => n + f.additions, 0),
    deletions: pull.files.reduce((n, f) => n + f.deletions, 0),
  };
}
