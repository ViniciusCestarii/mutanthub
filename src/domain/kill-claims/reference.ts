/**
 * Parses what a contributor typed as "the thing that kills this mutant":
 * a pull request (#123, 123, or a GitHub PR URL), a commit SHA, or a test path.
 */
export type KillReference =
  | { kind: "PULL_REQUEST"; number: number }
  | { kind: "COMMIT"; sha: string }
  | { kind: "TEST_PATH"; path: string };

const PR_URL = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:[/?#].*)?$/i;
const COMMIT_URL =
  /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/commit\/([0-9a-f]{7,40})(?:[/?#].*)?$/i;

export interface ParsedReference {
  reference: KillReference;
  /** Repository named in a URL, if any, so it can be checked against the project. */
  repository: { owner: string; repo: string } | null;
}

export function parseKillReference(raw: string): ParsedReference | null {
  const text = raw.trim();
  if (!text) return null;

  const prUrl = PR_URL.exec(text);
  if (prUrl) {
    return {
      reference: { kind: "PULL_REQUEST", number: Number(prUrl[3]) },
      repository: { owner: prUrl[1], repo: prUrl[2] },
    };
  }
  const commitUrl = COMMIT_URL.exec(text);
  if (commitUrl) {
    return {
      reference: { kind: "COMMIT", sha: commitUrl[3].toLowerCase() },
      repository: { owner: commitUrl[1], repo: commitUrl[2] },
    };
  }
  const prNumber = /^(?:#|pr\s*#?|pull\s*#?)?(\d{1,9})$/i.exec(text);
  if (prNumber)
    return { reference: { kind: "PULL_REQUEST", number: Number(prNumber[1]) }, repository: null };
  if (/^[0-9a-f]{7,40}$/i.test(text)) {
    return { reference: { kind: "COMMIT", sha: text.toLowerCase() }, repository: null };
  }
  if (/^[\w./+@-]+(?:::[\w:./-]+)?$/.test(text) && !text.startsWith("/") && !text.includes("..")) {
    return { reference: { kind: "TEST_PATH", path: text }, repository: null };
  }
  return null;
}

export function referenceLabel(kind: KillReference["kind"], reference: string): string {
  switch (kind) {
    case "PULL_REQUEST":
      return `PR #${reference}`;
    case "COMMIT":
      return `commit ${reference.slice(0, 7)}`;
    default:
      return reference;
  }
}

/** Heuristic: does a changed path look like a test? */
export function looksLikeTestPath(path: string): boolean {
  const lower = path.toLowerCase();
  return (
    /(^|\/)(tests?|testing|spec|specs|__tests__|unittests?|fuzz|qa)(\/|$)/.test(lower) ||
    /(_test|\.test|_spec|\.spec|test_)[^/]*$/.test(lower) ||
    /\/test[^/]*\.(c|cc|cpp|h|py|rs|go|java|kt|ts|js|rb|sh)$/.test(lower)
  );
}
