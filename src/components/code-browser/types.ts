import type { MutationOperator, MutationStatus, ReviewStatus } from "@/generated/prisma/enums";
import type { TreeEntry } from "@/server/github/types";

/** Serializable shapes passed from the server page to the client workspace. */

export interface BrowserProject {
  id: string;
  owner: string;
  repo: string;
  displayName: string;
  defaultBranch: string;
}

export interface BrowserCommit {
  sha: string;
  message: string;
  authorLogin: string | null;
  authorName: string | null;
  /** ISO string or null */
  date: string | null;
  htmlUrl: string;
  /** True when this commit is the current head of the default branch (or head is unknown). */
  isHead: boolean;
  headSha: string | null;
}

export interface BrowserRevision {
  commitSha: string;
  branch: string | null;
  commitMessage: string | null;
  commitDate: string | null;
  mutantCount: number;
}

export interface BrowserMutant {
  id: number;
  title: string;
  startLine: number;
  endLine: number;
  reviewStatus: ReviewStatus;
  mutationStatus: MutationStatus;
  mutationOperator: MutationOperator;
  createdBy: { githubUsername: string; avatarUrl: string | null };
  validationCount: number;
}

/** Pull request context for the code browser's PR mode (serializable). */
export interface BrowserPullRequest {
  id: string;
  number: number;
  title: string;
  headSha: string;
  state: "OPEN" | "CLOSED" | "MERGED";
  htmlUrl: string;
  /** Changed line ranges of the current file at the PR head (inclusive, 1-based). */
  ranges: Array<[number, number]>;
  /** False when the current file is not part of the PR diff. */
  fileInDiff: boolean;
  /** True when the browsed commit is the PR head. */
  atHead: boolean;
}

export interface BrowserFile {
  path: string;
  size: number;
  content: string | null;
  tooLarge: boolean;
  binary: boolean;
  htmlUrl: string;
  mutants: BrowserMutant[];
  mutantsAtOtherRevisions: number;
}

export interface BrowserDirectory {
  path: string;
  entries: TreeEntry[];
}

export type BrowserTarget =
  { kind: "file"; file: BrowserFile } | { kind: "dir"; dir: BrowserDirectory };

/** Directory path -> entries, preloaded for the root and the ancestors of the current path. */
export type TreeCache = Record<string, TreeEntry[]>;

export type { TreeEntry };
