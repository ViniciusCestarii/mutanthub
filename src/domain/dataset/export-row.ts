/**
 * The public dataset row: one mutant with its location, outcome, evidence and
 * reproduction summary, flattened so JSON and CSV share the same columns.
 * Column order is part of the contract; append new columns at the end.
 */
export interface ExportRow {
  id: number;
  repository: string;
  language: string | null;
  commit: string;
  pullRequest: number | null;
  file: string;
  startLine: number;
  endLine: number;
  title: string;
  description: string | null;
  mutationOperator: string;
  originalCode: string;
  mutatedCode: string;
  diff: string;
  reviewStatus: string;
  mutationStatus: string;
  observedResult: string | null;
  buildCommand: string | null;
  testCommand: string | null;
  fuzzCommand: string | null;
  environment: string | null;
  reproductions: number;
  reproducedSurvived: number;
  reproducedKilled: number;
  reproducedCouldNotReproduce: number;
  killingTestRefs: string | null;
  contributor: string;
  createdAt: string;
  updatedAt: string;
  url: string;
  /** Structured kill claims, e.g. "PR #123 (VERIFIED) | commit abc1234 (CLAIMED)". */
  killClaims: string | null;
}

export const EXPORT_COLUMNS: ReadonlyArray<keyof ExportRow> = [
  "id",
  "repository",
  "language",
  "commit",
  "pullRequest",
  "file",
  "startLine",
  "endLine",
  "title",
  "description",
  "mutationOperator",
  "originalCode",
  "mutatedCode",
  "diff",
  "reviewStatus",
  "mutationStatus",
  "observedResult",
  "buildCommand",
  "testCommand",
  "fuzzCommand",
  "environment",
  "reproductions",
  "reproducedSurvived",
  "reproducedKilled",
  "reproducedCouldNotReproduce",
  "killingTestRefs",
  "contributor",
  "createdAt",
  "updatedAt",
  "url",
  "killClaims",
];

/** Hard cap on rows per export request or snapshot. */
export const EXPORT_MAX_ROWS = 50_000;
export const EXPORT_DEFAULT_ROWS = 10_000;
