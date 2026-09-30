import { createHash } from "node:crypto";

/**
 * Normalizes a code snippet so that cosmetic differences (indentation,
 * trailing whitespace, CRLF, blank lines) do not produce different fingerprints.
 */
export function normalizeCode(code: string): string {
  return code
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter((line) => line.length > 0)
    .join("\n");
}

export interface FingerprintInput {
  projectId: string;
  revisionId: string;
  filePath: string;
  startLine: number;
  originalCode: string;
  mutatedCode: string;
}

/**
 * Length-prefixes every field so that no field content can masquerade as a
 * field boundary (e.g. a file path containing the separator).
 */
function encodeFields(fields: string[]): string {
  return fields.map((f) => `${f.length}:${f}`).join("|");
}

/**
 * Exact fingerprint: same project, revision, file, start line and normalized
 * code pair. Two submissions with the same fingerprint are considered
 * identical mutants. The start line is part of the identity because a file
 * often repeats a statement; within one revision the line is a stable location.
 */
export function computeFingerprint(input: FingerprintInput): string {
  const material = encodeFields([
    input.projectId,
    input.revisionId,
    input.filePath.trim(),
    String(input.startLine),
    normalizeCode(input.originalCode),
    normalizeCode(input.mutatedCode),
  ]);
  return createHash("sha256").update(material).digest("hex");
}

/** Nearest non-blank lines around a mutant, normalized like the code pair. */
export interface SimilarityContext {
  before: string[];
  after: string[];
}

/** Non-blank lines taken on each side of the mutated span. */
export const SIMILARITY_CONTEXT_LINES = 2;

/**
 * Current similarity key scheme. Version 1 keys (code pair only) are left on
 * older rows until the similarity backfill job recomputes them; the two
 * versions never match each other.
 */
export const SIMILARITY_KEY_VERSION = 2;

/**
 * The lines around `startLine..endLine` of a file, skipping blank lines so an
 * inserted empty line does not change the key.
 */
export function extractSimilarityContext(
  content: string,
  startLine: number,
  endLine: number,
  radius = SIMILARITY_CONTEXT_LINES,
): SimilarityContext {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const pick = (from: number, step: number) => {
    const out: string[] = [];
    for (let i = from; i >= 0 && i < lines.length && out.length < radius; i += step) {
      const line = normalizeCode(lines[i]);
      if (line) out.push(line);
    }
    return out;
  };
  return {
    before: pick(startLine - 2, -1).reverse(),
    after: pick(endLine, 1),
  };
}

/**
 * Identity of a mutation independent of commit and exact line: the normalized
 * code pair plus the nearest surrounding lines. It links runs of a tool across
 * commits (the code may have moved), while a statement repeated elsewhere in
 * the file (e.g. `return 0;`) gets a different key because its surroundings
 * differ. Used for "similar" hints, the import report and superseded results.
 */
export function computeSimilarityKey(
  input: Omit<FingerprintInput, "revisionId" | "startLine"> & { context: SimilarityContext },
): string {
  const material = encodeFields([
    `v${SIMILARITY_KEY_VERSION}`,
    input.projectId,
    input.filePath.trim(),
    normalizeCode(input.originalCode),
    normalizeCode(input.mutatedCode),
    encodeFields(input.context.before),
    encodeFields(input.context.after),
  ]);
  return createHash("sha256").update(material).digest("hex");
}
