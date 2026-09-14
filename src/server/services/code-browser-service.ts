import "server-only";
import type { Project } from "@/generated/prisma/client";
import { getGitHubClient } from "@/server/github";
import type { CommitInfo, FileContent, TreeEntry } from "@/server/github/types";
import { projectRepository } from "@/server/repositories/project-repository";
import { mutantRepository, type MutantListItem } from "@/server/repositories/mutant-repository";
import { mutantService } from "./mutant-service";
import { projectService } from "./project-service";

export interface FileView {
  commit: CommitInfo;
  file: FileContent;
  mutants: MutantListItem[];
  /** Mutants for the same path recorded against other commits. */
  mutantsAtOtherRevisions: number;
  /** True when a Revision row exists (i.e. some mutant already targets this commit). */
  revisionKnown: boolean;
}

/**
 * Read-only browsing of repository contents through the GitHub abstraction.
 * Nothing is persisted here except the Revision row that a mutant needs.
 */
export const codeBrowserService = {
  resolveRef(project: Project, ref?: string | null): Promise<CommitInfo> {
    return getGitHubClient().getCommit(
      project.githubOwner,
      project.githubRepository,
      ref || project.defaultBranch,
    );
  },

  async getTree(
    project: Project,
    ref: string,
    path: string,
  ): Promise<{ commit: CommitInfo; entries: TreeEntry[] }> {
    const client = getGitHubClient();
    const commit = await this.resolveRef(project, ref);
    const entries = await client.getTree(
      project.githubOwner,
      project.githubRepository,
      commit.sha,
      path,
    );
    return { commit, entries };
  },

  async getFile(project: Project, ref: string, path: string): Promise<FileView> {
    const client = getGitHubClient();
    const commit = await this.resolveRef(project, ref);
    const file = await client.getFile(
      project.githubOwner,
      project.githubRepository,
      commit.sha,
      path,
    );
    const revision = await projectRepository.findRevision(project.id, commit.sha);
    if (!revision) {
      return {
        commit,
        file,
        mutants: [],
        mutantsAtOtherRevisions: await countOtherRevisions(project.id, path),
        revisionKnown: false,
      };
    }
    const { mutants, otherRevisions } = await mutantService.listForFile(
      project.id,
      revision.id,
      path,
    );
    return { commit, file, mutants, mutantsAtOtherRevisions: otherRevisions, revisionKnown: true };
  },

  /** Ensures a Revision exists for the commit being browsed (called lazily before submission). */
  ensureRevision(project: Project, ref: string) {
    return projectService.ensureRevision(project, ref);
  },
};

function countOtherRevisions(projectId: string, filePath: string): Promise<number> {
  return mutantRepository.countForFileOtherRevisions(projectId, "", filePath);
}

/** Revisions of a project that carry mutants (for the commit selector). Additive helper. */
export function listRevisionsForSelector(projectId: string) {
  return projectRepository.listRevisionsWithMutants(projectId);
}
