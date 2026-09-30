import "server-only";
import {
  computeSimilarityKey,
  extractSimilarityContext,
  SIMILARITY_KEY_VERSION,
} from "@/domain/mutants/fingerprint";
import type { Project } from "@/generated/prisma/client";
import { getGitHubClient, isGitHubError } from "@/server/github";
import { mutantRepository } from "@/server/repositories/mutant-repository";

export interface SimilarityTarget {
  filePath: string;
  startLine: number;
  endLine: number;
  originalCode: string;
  mutatedCode: string;
}

export interface SimilarityKeyResult {
  /** Null when the file could not be read: the mutant is then linked to nothing. */
  similarityKey: string | null;
  similarityKeyVersion: number;
}

/** The key for a mutant whose file content is already at hand (null: unreadable). */
export function similarityKeyFromContent(
  projectId: string,
  target: SimilarityTarget,
  content: string | null,
): SimilarityKeyResult {
  return {
    similarityKey:
      content == null
        ? null
        : computeSimilarityKey({
            projectId,
            filePath: target.filePath,
            originalCode: target.originalCode,
            mutatedCode: target.mutatedCode,
            context: extractSimilarityContext(content, target.startLine, target.endLine),
          }),
    similarityKeyVersion: SIMILARITY_KEY_VERSION,
  };
}

/**
 * Reads the file at the commit (through the cached GitHub client) to key the
 * mutant by its surrounding lines. A missing, binary or oversized file yields a
 * null key; a GitHub rate limit is rethrown so callers can surface it.
 */
export async function similarityKeyAt(
  project: Project,
  commitSha: string,
  target: SimilarityTarget,
): Promise<SimilarityKeyResult> {
  let content: string | null = null;
  try {
    const file = await getGitHubClient().getFile(
      project.githubOwner,
      project.githubRepository,
      commitSha,
      target.filePath,
    );
    content = file.content;
  } catch (e) {
    if (isGitHubError(e) && e.kind === "RATE_LIMITED") throw e;
  }
  return similarityKeyFromContent(project.id, target, content);
}

export interface SimilarityBackfillResult {
  /** Mutants whose key was recomputed with context. */
  updated: number;
  /** Of those, mutants whose file could not be read (key cleared). */
  unreadable: number;
  /** Mutants still on an older key scheme after this run. */
  remaining: number;
  /** True when GitHub's rate limit stopped the run early. */
  rateLimited: boolean;
}

/**
 * Recomputes older similarity keys (code pair only) with the surrounding
 * lines, reading each (commit, file) once, and refreshes the superseded flags
 * of every group a key left or joined. Stops early on a GitHub rate limit and
 * can simply be run again; idempotent once nothing is left.
 */
export async function backfillSimilarityKeys(limit = 5000): Promise<SimilarityBackfillResult> {
  const pending = await mutantRepository.listForSimilarityBackfill(SIMILARITY_KEY_VERSION, limit);
  const contents = new Map<string, string | null>();
  const updates: Array<{ id: number; previousKey: string | null } & SimilarityKeyResult> = [];
  let rateLimited = false;
  for (const m of pending) {
    const fileKey = `${m.revision.commitSha}:${m.filePath}`;
    if (!contents.has(fileKey)) {
      try {
        const file = await getGitHubClient().getFile(
          m.project.githubOwner,
          m.project.githubRepository,
          m.revision.commitSha,
          m.filePath,
        );
        contents.set(fileKey, file.content);
      } catch (e) {
        if (isGitHubError(e) && e.kind === "RATE_LIMITED") {
          rateLimited = true;
          break;
        }
        contents.set(fileKey, null);
      }
    }
    updates.push({
      id: m.id,
      previousKey: m.similarityKey,
      ...similarityKeyFromContent(m.projectId, m, contents.get(fileKey) ?? null),
    });
  }
  await mutantRepository.setSimilarityKeys(updates);
  const remaining = await mutantRepository.countForSimilarityBackfill(SIMILARITY_KEY_VERSION);
  return {
    updated: updates.length,
    unreadable: updates.filter((u) => u.similarityKey === null).length,
    remaining,
    rateLimited,
  };
}
