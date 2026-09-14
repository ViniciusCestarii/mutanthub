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
