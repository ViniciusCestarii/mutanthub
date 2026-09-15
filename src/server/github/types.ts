/**
 * GitHub access abstraction. The rest of the server only depends on this
 * interface, so the live REST client and the fixture-backed mock are
 * interchangeable (and a GitHub App / GraphQL client can be added later).
 */

export interface RepositoryInfo {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  description: string | null;
  defaultBranch: string;
  language: string | null;
  htmlUrl: string;
  isPrivate: boolean;
  isArchived: boolean;
}

export interface CommitInfo {
  sha: string;
  message: string;
  authorName: string | null;
  authorLogin: string | null;
  date: Date | null;
  htmlUrl: string;
}

export interface TreeEntry {
  name: string;
  path: string;
  type: "file" | "dir" | "symlink" | "submodule";
  size: number | null;
}

export interface FileContent {
  path: string;
  sha: string;
  size: number;
  /** Decoded UTF-8 text, or null when the file is binary or too large. */
  content: string | null;
  tooLarge: boolean;
  binary: boolean;
  htmlUrl: string;
}

export interface PullRequestInfo {
  number: number;
  title: string;
  authorLogin: string | null;
  state: "OPEN" | "CLOSED" | "MERGED";
  baseRef: string;
  baseSha: string;
  headRef: string;
  headSha: string;
  /** Merge commit on the base branch once merged; null otherwise. */
  mergeCommitSha: string | null;
  htmlUrl: string;
  changedFiles: number;
  additions: number;
  deletions: number;
}

export interface PullRequestFile {
  path: string;
  status: "added" | "modified" | "removed" | "renamed" | "copied" | "changed" | "unchanged";
  additions: number;
  deletions: number;
  /** Added or modified line ranges in the head commit (inclusive, 1-based). */
  changedRanges: Array<[number, number]>;
}

export type GitHubErrorKind =
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "UNAUTHORIZED"
  | "UNAVAILABLE"
  | "NETWORK"
  | "TOO_LARGE"
  | "INVALID";

export class GitHubError extends Error {
  readonly kind: GitHubErrorKind;
  readonly resetAt: Date | null;

  constructor(kind: GitHubErrorKind, message: string, resetAt: Date | null = null) {
    super(message);
    this.name = "GitHubError";
    this.kind = kind;
    this.resetAt = resetAt;
  }
}

/**
 * Type guard that also recognises instances created by another copy of this
 * module: the GitHub client is a process-wide singleton, and Next.js compiles
 * route handlers and Server Components as separate module graphs, so
 * `instanceof` alone is not reliable across them.
 */
export function isGitHubError(e: unknown): e is GitHubError {
  if (e instanceof GitHubError) return true;
  return (
    e instanceof Error &&
    e.name === "GitHubError" &&
    typeof (e as { kind?: unknown }).kind === "string"
  );
}

/** Files above this size are not loaded into the viewer (GitHub caps the contents API at 1 MB anyway). */
export const MAX_FILE_BYTES = 512 * 1024;

export interface GitHubClient {
  readonly mode: "live" | "mock";
  getRepository(owner: string, repo: string): Promise<RepositoryInfo>;
  /** Resolves a branch, tag or SHA to full commit metadata. */
  getCommit(owner: string, repo: string, ref: string): Promise<CommitInfo>;
  /** Lists a directory at a given ref. `path` is "" for the root. */
  getTree(owner: string, repo: string, ref: string, path: string): Promise<TreeEntry[]>;
  getFile(owner: string, repo: string, ref: string, path: string): Promise<FileContent>;
  getPullRequest(owner: string, repo: string, number: number): Promise<PullRequestInfo>;
  /** Changed files with head-side line ranges (GitHub caps this at 3000 files). */
  getPullRequestFiles(owner: string, repo: string, number: number): Promise<PullRequestFile[]>;
}
