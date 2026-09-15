import { normalizeCode } from "@/domain/mutants/fingerprint";

export type AppliesResult =
  | { applies: "APPLIES"; line: number }
  | { applies: "MOVED"; line: number }
  | { applies: "NOT_FOUND"; line: null };

/**
 * Does the mutant's original code still exist in `content` (the file at the
 * verification commit)? Exact position first, then anywhere in the file with
 * whitespace-insensitive matching. This is a text check, not a build: it says
 * whether verifying the claim is meaningful, nothing more.
 */
export function locateOriginalCode(
  content: string,
  originalCode: string,
  expectedStartLine: number,
): AppliesResult {
  const target = normalizeCode(originalCode).split("\n");
  if (target.length === 0 || target[0] === "") return { applies: "NOT_FOUND", line: null };
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const normalized = lines.map((l) => normalizeCode(l));

  const matchesAt = (index: number): boolean => {
    // Skip blank lines in the file while matching, since normalizeCode drops them from the target.
    let i = index;
    for (const wanted of target) {
      while (i < normalized.length && normalized[i] === "") i += 1;
      if (i >= normalized.length || normalized[i] !== wanted) return false;
      i += 1;
    }
    return true;
  };

  const expectedIndex = expectedStartLine - 1;
  if (expectedIndex >= 0 && expectedIndex < lines.length && matchesAt(expectedIndex)) {
    return { applies: "APPLIES", line: expectedStartLine };
  }
  for (let i = 0; i < normalized.length; i += 1) {
    if (normalized[i] !== "" && normalized[i] === target[0] && matchesAt(i)) {
      return { applies: "MOVED", line: i + 1 };
    }
  }
  return { applies: "NOT_FOUND", line: null };
}
