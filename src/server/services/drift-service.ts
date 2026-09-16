import "server-only";
import type { Principal } from "@/domain/auth/permissions";
import { canManageProject } from "@/domain/auth/permissions";
import { classifyDrift } from "@/domain/drift/status";
import { locateOriginalCode } from "@/domain/kill-claims/applies";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { getGitHubClient } from "@/server/github";
import { isGitHubError } from "@/server/github/types";
import { enforceRateLimit } from "@/server/infra/rate-limit";
import { auditRepository } from "@/server/repositories/audit-repository";
import { driftRepository } from "@/server/repositories/drift-repository";
import { activityRepository } from "@/server/repositories/interaction-repository";
import { projectRepository } from "@/server/repositories/project-repository";
import type { Project } from "@/generated/prisma/client";

export interface DriftSummary {
  projectId: string;
  project: string;
  headSha: string;
  /** Mutants looked up. */
  checked: number;
  applies: number;
  moved: number;
  gone: number;
  /** Files that could not be read at HEAD (their mutants count as gone). */
  missingFiles: string[];
}

/**
 * Drift check: is each open mutant's original code still where it was on the
 * project's default branch? Reads files once per path, writes one result per
 * mutant, and notifies a submitter the first time their code disappears.
 */
export const driftService = {
  async checkAsMaintainer(principal: Principal | null, projectId: string): Promise<DriftSummary> {
    if (!principal || !canManageProject(principal, projectId))
      throw forbidden("Only maintainers can run the drift check");
    const project = await projectRepository.findById(projectId);
    if (!project) throw notFound("Project");
    await enforceRateLimit({
      action: "drift-check",
      subject: projectId,
      limit: 6,
      windowMs: 60 * 60 * 1000,
    });
    return this.checkProject(project, principal.id);
  },

  /** Runs the check for every active project (scheduled job). Failures are reported, not thrown. */
  async checkAll(): Promise<
    Array<DriftSummary | { projectId: string; project: string; error: string }>
  > {
    const projects = await projectRepository.listActiveFull();
    const results: Array<DriftSummary | { projectId: string; project: string; error: string }> = [];
    for (const project of projects) {
      try {
        results.push(await this.checkProject(project, null));
      } catch (e) {
        results.push({
          projectId: project.id,
          project: project.displayName,
          error: e instanceof Error ? e.message : "unknown error",
        });
      }
    }
    return results;
  },

  async checkProject(project: Project, actorId: string | null): Promise<DriftSummary> {
    const client = getGitHubClient();
    let headSha: string;
    try {
      headSha = (
        await client.getCommit(project.githubOwner, project.githubRepository, project.defaultBranch)
      ).sha;
    } catch (e) {
      throw new AppError(
        "UPSTREAM",
        `Could not read the default branch from GitHub${isGitHubError(e) ? ` (${e.kind.toLowerCase()})` : ""}`,
      );
    }

    const mutants = await driftRepository.listOpenForProject(project.id);
    const files = new Map<string, string | null>();
    const missingFiles = new Set<string>();
    const summary: DriftSummary = {
      projectId: project.id,
      project: project.displayName,
      headSha,
      checked: mutants.length,
      applies: 0,
      moved: 0,
      gone: 0,
      missingFiles: [],
    };
    const checkedAt = new Date();

    for (const mutant of mutants) {
      if (!files.has(mutant.filePath)) {
        try {
          const file = await client.getFile(
            project.githubOwner,
            project.githubRepository,
            headSha,
            mutant.filePath,
          );
          files.set(mutant.filePath, file.content);
        } catch (e) {
          if (isGitHubError(e) && e.kind === "RATE_LIMITED")
            throw new AppError("UPSTREAM", "GitHub rate limit reached; try again later");
          files.set(mutant.filePath, null);
          missingFiles.add(mutant.filePath);
        }
      }
      const content = files.get(mutant.filePath);
      const result =
        content == null
          ? { status: "GONE" as const, line: null }
          : classifyDrift(locateOriginalCode(content, mutant.originalCode, mutant.startLine));

      if (result.status === "APPLIES") summary.applies += 1;
      else if (result.status === "MOVED") summary.moved += 1;
      else summary.gone += 1;

      await driftRepository.updateResult(mutant.id, {
        driftStatus: result.status,
        driftLine: result.line,
        driftCommitSha: headSha,
        driftCheckedAt: checkedAt,
      });
      // Tell the submitter once: the code they mutated is no longer there.
      if (result.status === "GONE" && mutant.driftStatus !== "GONE") {
        await activityRepository.recordEvent({
          type: "MUTANT_DRIFTED",
          actorId: null,
          projectId: project.id,
          mutantId: mutant.id,
          payload: { head: headSha, previous: mutant.driftStatus },
          detail: headSha.slice(0, 7),
        });
      }
    }

    await driftRepository.markProjectChecked(project.id, headSha, checkedAt);
    summary.missingFiles = [...missingFiles];
    await auditRepository.record({
      actorId,
      action: "DRIFT_CHECKED",
      projectId: project.id,
      targetType: "project",
      targetId: project.id,
      metadata: {
        head: headSha,
        checked: summary.checked,
        applies: summary.applies,
        moved: summary.moved,
        gone: summary.gone,
      },
    });
    return summary;
  },
};
