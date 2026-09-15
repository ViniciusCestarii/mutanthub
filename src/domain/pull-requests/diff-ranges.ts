/**
 * Pure helpers for pull-request diffs: which lines of the head commit were
 * added or modified, and whether a mutant location falls inside them.
 */

/** Inclusive 1-based line range in the head version of a file. */
export type LineRange = [start: number, end: number];

/** Map from file path to changed ranges in the head commit. */
export type ChangedRanges = Record<string, LineRange[]>;

const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

/**
 * Extracts the head-side line numbers that a unified `patch` (as returned by
 * the GitHub "list pull request files" API) adds or modifies. Deleted lines
 * have no head line and are ignored; context lines are not changes.
 */
export function changedRangesFromPatch(patch: string | null | undefined): LineRange[] {
  if (!patch) return [];
  const ranges: LineRange[] = [];
  let headLine = 0;
  let inHunk = false;
  for (const raw of patch.replace(/\r\n?/g, "\n").split("\n")) {
    const hunk = HUNK_HEADER.exec(raw);
    if (hunk) {
      headLine = Number(hunk[1]);
      inHunk = true;
      continue;
    }
    if (!inHunk) continue;
    if (raw.startsWith("+")) {
      pushLine(ranges, headLine);
      headLine += 1;
    } else if (raw.startsWith("-")) {
      // Removed from base: no head line number advances.
    } else if (raw.startsWith("\\")) {
      // "\ No newline at end of file"
    } else {
      headLine += 1;
    }
  }
  return ranges;
}

function pushLine(ranges: LineRange[], line: number): void {
  const last = ranges[ranges.length - 1];
  if (last && last[1] === line - 1) last[1] = line;
  else ranges.push([line, line]);
}

export function mergeRanges(ranges: LineRange[]): LineRange[] {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out: LineRange[] = [];
  for (const [start, end] of sorted) {
    const last = out[out.length - 1];
    if (last && start <= last[1] + 1) last[1] = Math.max(last[1], end);
    else out.push([start, end]);
  }
  return out;
}

export function isLineInRanges(line: number, ranges: LineRange[] | undefined): boolean {
  if (!ranges) return false;
  return ranges.some(([start, end]) => line >= start && line <= end);
}

/** True when any line of the mutant's span is part of the PR diff for its file. */
export function mutantTouchesDiff(
  mutant: { filePath: string; startLine: number; endLine: number },
  changed: ChangedRanges,
): boolean {
  const ranges = changed[mutant.filePath];
  if (!ranges) return false;
  return ranges.some(([start, end]) => mutant.endLine >= start && mutant.startLine <= end);
}

export function countChangedLines(ranges: LineRange[]): number {
  return ranges.reduce((n, [start, end]) => n + (end - start + 1), 0);
}

/** Normalises arbitrary JSON (from the database) into ChangedRanges. */
export function parseChangedRanges(value: unknown): ChangedRanges {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: ChangedRanges = {};
  for (const [path, ranges] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(ranges)) continue;
    const clean: LineRange[] = [];
    for (const r of ranges) {
      if (
        Array.isArray(r) &&
        r.length === 2 &&
        Number.isInteger(r[0]) &&
        Number.isInteger(r[1]) &&
        r[0] >= 1 &&
        r[1] >= r[0]
      ) {
        clean.push([r[0], r[1]]);
      }
    }
    if (clean.length) out[path] = mergeRanges(clean);
  }
  return out;
}
