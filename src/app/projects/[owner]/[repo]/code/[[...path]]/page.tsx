import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CodeWorkspace } from "@/components/code-browser/code-workspace";
import type {
  BrowserCommit,
  BrowserMutant,
  BrowserRevision,
  BrowserTarget,
  TreeCache,
} from "@/components/code-browser/types";
import { ErrorState } from "@/components/shared/error-states";
import { isAppError } from "@/lib/errors";
import { routes } from "@/lib/routes";
import { getCurrentUser } from "@/server/auth/session";
import { isGitHubError, type CommitInfo, type TreeEntry } from "@/server/github/types";
import type { MutantListItem } from "@/server/repositories/mutant-repository";
import {
  codeBrowserService,
  listRevisionsForSelector,
} from "@/server/services/code-browser-service";
import { projectService } from "@/server/services/project-service";
import { pullRequestService } from "@/server/services/pull-request-service";
import type { Project } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ owner: string; repo: string; path?: string[] }>;
  searchParams: Promise<{ ref?: string; pr?: string }>;
}

function joinPath(segments: string[] | undefined): string {
  return (segments ?? []).map((s) => decodeURIComponent(s)).join("/");
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { owner, repo, path } = await params;
  const filePath = joinPath(path);
  return { title: `${filePath || `${owner}/${repo}`} · code` };
}

/** Root + every ancestor directory of `path`, so the tree opens along the current file. */
function ancestorDirs(path: string, isDir: boolean): string[] {
  const parts = path.split("/").filter(Boolean);
  const dirs = [""];
  const depth = isDir ? parts.length : parts.length - 1;
  for (let i = 1; i <= depth; i++) dirs.push(parts.slice(0, i).join("/"));
  return dirs;
}

/**
 * Resolves the path to a directory listing or a file. Both GitHub clients
 * throw an INVALID GitHubError when `getTree` is called on a file, so we try
 * the directory first and fall back to the file — one round-trip for
 * directories, two (cached) for files.
 */
async function loadTarget(project: Project, ref: string, path: string) {
  if (path === "") {
    const { commit, entries } = await codeBrowserService.getTree(project, ref, "");
    return { commit, target: { kind: "dir", dir: { path: "", entries } } as const };
  }
  try {
    const { commit, entries } = await codeBrowserService.getTree(project, ref, path);
    return { commit, target: { kind: "dir", dir: { path, entries } } as const };
  } catch (e) {
    if (!(isGitHubError(e) && e.kind === "INVALID")) throw e;
  }
  const view = await codeBrowserService.getFile(project, ref, path);
  return { commit: view.commit, view };
}

function toBrowserMutant(m: MutantListItem): BrowserMutant {
  return {
    id: m.id,
    title: m.title,
    startLine: m.startLine,
    endLine: m.endLine,
    reviewStatus: m.reviewStatus,
    mutationStatus: m.mutationStatus,
    mutationOperator: m.mutationOperator,
    createdBy: { githubUsername: m.createdBy.githubUsername, avatarUrl: m.createdBy.avatarUrl },
    validationCount: m._count.validations,
  };
}

function toBrowserCommit(commit: CommitInfo, headSha: string | null): BrowserCommit {
  return {
    sha: commit.sha,
    message: commit.message,
    authorLogin: commit.authorLogin,
    authorName: commit.authorName,
    date: commit.date ? commit.date.toISOString() : null,
    htmlUrl: commit.htmlUrl,
    isHead: headSha === null || headSha === commit.sha,
    headSha,
  };
}

export default async function CodePage({ params, searchParams }: PageProps) {
  const [{ owner, repo, path: segments }, { ref: refParam, pr: prParam }, user] = await Promise.all(
    [params, searchParams, getCurrentUser()],
  );
  const path = joinPath(segments);

  let project: Project;
  try {
    project = await projectService.getBySlugOrThrow(owner, repo);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }

  // Pull request mode: highlight the PR's changed lines and default to its head commit.
  const prNumber = Number(prParam);
  const prContext =
    Number.isInteger(prNumber) && prNumber > 0
      ? await pullRequestService.getFileContext(project, prNumber, path)
      : null;
  const ref = refParam?.trim() || prContext?.headSha || project.defaultBranch;
  const backHref = routes.project(project.githubOwner, project.githubRepository);

  let loaded: Awaited<ReturnType<typeof loadTarget>>;
  try {
    loaded = await loadTarget(project, ref, path);
  } catch (e) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-12">
        <ErrorState error={e} backHref={backHref} backLabel="Back to project" />
      </main>
    );
  }

  const isDir = loaded.target?.kind === "dir";
  const [head, revisions, treeResults] = await Promise.all([
    projectService.getHeadCommit(project),
    listRevisionsForSelector(project.id),
    Promise.allSettled(
      ancestorDirs(path, isDir).map(async (dir) => {
        if (isDir && dir === path) return [dir, loaded.target!.dir.entries] as const;
        const { entries } = await codeBrowserService.getTree(project, loaded.commit.sha, dir);
        return [dir, entries] as const;
      }),
    ),
  ]);

  const treeCache: TreeCache = {};
  for (const result of treeResults) {
    if (result.status === "fulfilled") {
      const [dir, entries] = result.value as readonly [string, TreeEntry[]];
      treeCache[dir] = entries;
    }
  }

  const target: BrowserTarget = loaded.target
    ? loaded.target
    : {
        kind: "file",
        file: {
          path: loaded.view!.file.path,
          size: loaded.view!.file.size,
          content: loaded.view!.file.content,
          tooLarge: loaded.view!.file.tooLarge,
          binary: loaded.view!.file.binary,
          htmlUrl: loaded.view!.file.htmlUrl,
          mutants: loaded.view!.mutants.map(toBrowserMutant),
          mutantsAtOtherRevisions: loaded.view!.mutantsAtOtherRevisions,
        },
      };

  const browserRevisions: BrowserRevision[] = revisions.map((r) => ({
    commitSha: r.commitSha,
    branch: r.branch,
    commitMessage: r.commitMessage,
    commitDate: r.commitDate ? r.commitDate.toISOString() : null,
    mutantCount: r._count.mutants,
  }));

  return (
    <CodeWorkspace
      project={{
        id: project.id,
        owner: project.githubOwner,
        repo: project.githubRepository,
        displayName: project.displayName,
        defaultBranch: project.defaultBranch,
      }}
      commit={toBrowserCommit(loaded.commit, head?.sha ?? null)}
      gitRef={ref}
      path={path}
      target={target}
      treeCache={treeCache}
      revisions={browserRevisions}
      signedIn={Boolean(user)}
      pullRequest={
        prContext
          ? {
              id: prContext.id,
              number: prContext.number,
              title: prContext.title,
              headSha: prContext.headSha,
              state: prContext.state,
              htmlUrl: prContext.htmlUrl,
              ranges: prContext.ranges,
              fileInDiff: prContext.fileInDiff,
              atHead: loaded.commit.sha === prContext.headSha,
            }
          : null
      }
    />
  );
}
