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

export function isGitHubError(e: unknown): e is GitHubError {
  return e instanceof GitHubError;
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
}
