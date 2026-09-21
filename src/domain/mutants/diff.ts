/**
 * Small, dependency-free helpers for unified diffs. They are intentionally
 * conservative: we never apply patches on the server, we only render, count
 * and generate them.
 */

export interface DiffStats {
  additions: number;
  deletions: number;
  hunks: number;
  files: string[];
}

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

export function parseDiffStats(diff: string): DiffStats {
  const stats: DiffStats = { additions: 0, deletions: 0, hunks: 0, files: [] };
  for (const rawLine of diff.replace(/\r\n?/g, "\n").split("\n")) {
    if (rawLine.startsWith("+++ ")) {
      const name = rawLine.slice(4).trim().replace(/^b\//, "");
      if (name && name !== "/dev/null") stats.files.push(name);
      continue;
    }
    if (rawLine.startsWith("--- ")) continue;
    if (HUNK_HEADER.test(rawLine)) {
      stats.hunks += 1;
      continue;
    }
    if (rawLine.startsWith("+")) stats.additions += 1;
    else if (rawLine.startsWith("-")) stats.deletions += 1;
  }
  return stats;
}

/** True when the text looks like a unified diff (has at least one hunk or +/- line). */
export function looksLikeUnifiedDiff(diff: string): boolean {
  const trimmed = diff.trim();
  if (!trimmed) return false;
  const lines = trimmed.split(/\r?\n/);
  return lines.some((l) => HUNK_HEADER.test(l)) || lines.some((l) => /^[+-](?![+-]{2})/.test(l));
}

export interface GenerateDiffInput {
  filePath: string;
  startLine: number;
  originalCode: string;
  mutatedCode: string;
}

/**
 * Builds a minimal unified diff replacing the original block with the mutated
 * block. Used to pre-fill the diff field when a contributor only pasted code.
 */
export function generateUnifiedDiff(input: GenerateDiffInput): string {
  const original = splitLines(input.originalCode);
  const mutated = splitLines(input.mutatedCode);
  const path = input.filePath.replace(/^\/+/, "");
  const header = `--- a/${path}\n+++ b/${path}`;
  const hunk = `@@ -${input.startLine},${original.length} +${input.startLine},${mutated.length} @@`;
  const body = [...original.map((l) => `-${l}`), ...mutated.map((l) => `+${l}`)].join("\n");
  return `${header}\n${hunk}\n${body}\n`;
}

function splitLines(code: string): string[] {
  const normalized = code.replace(/\r\n?/g, "\n").replace(/\n$/, "");
  return normalized.length === 0 ? [] : normalized.split("\n");
}

export interface DiffSides {
  original: string;
  modified: string;
}

/**
 * Rebuilds the two sides of a unified diff so a side-by-side viewer can show
 * the same content as the patch (context lines and every hunk). Gaps between
 * hunks become an ellipsis line on both sides. Returns null when the text is
 * not a unified diff.
 */
export function splitUnifiedDiff(diff: string): DiffSides | null {
  if (!looksLikeUnifiedDiff(diff)) return null;
  const original: string[] = [];
  const modified: string[] = [];
  let seenHunk = false;
  for (const line of diff.replace(/\r\n?/g, "\n").replace(/\n$/, "").split("\n")) {
    if (HUNK_HEADER.test(line)) {
      if (seenHunk) {
        original.push("…");
        modified.push("…");
      }
      seenHunk = true;
      continue;
    }
    if (
      line.startsWith("+++") ||
      line.startsWith("---") ||
      line.startsWith("diff ") ||
      line.startsWith("index ") ||
      line.startsWith("\\ ")
    )
      continue;
    const body = line.slice(1);
    if (line.startsWith("+")) modified.push(body);
    else if (line.startsWith("-")) original.push(body);
    else {
      original.push(body);
      modified.push(body);
    }
  }
  return { original: original.join("\n"), modified: modified.join("\n") };
}

/** Extracts the first file path referenced by a unified diff, if any. */
export function extractDiffFilePath(diff: string): string | null {
  const stats = parseDiffStats(diff);
  return stats.files[0] ?? null;
}
