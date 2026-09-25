import Link from "next/link";
import { ExternalLink, FileCode2, GitCommitHorizontal, FolderGit2 } from "lucide-react";
import type { MutantDetail } from "@/server/repositories/mutant-repository";
import {
  MutationStatusBadge,
  OperatorBadge,
  ReviewStatusBadge,
} from "@/components/mutants/status-badge";
import { UserChip } from "@/components/shared/user-chip";
import { CopyButton } from "@/components/shared/copy-button";
import { EditableTitle } from "@/components/mutant-detail/editable-title";
import { routes } from "@/lib/routes";
import { absoluteDateTime, relativeTime, shortSha } from "@/lib/format";

interface MutantHeaderProps {
  mutant: MutantDetail;
  /** Compact variant used inside the review panel. */
  compact?: boolean;
  actions?: React.ReactNode;
  /** Shows an inline title editor (owner or admin). */
  canEditTitle?: boolean;
}

export function MutantHeader({ mutant, compact, actions, canEditTitle }: MutantHeaderProps) {
  const { project, revision } = mutant;
  const owner = project.githubOwner;
  const repo = project.githubRepository;
  const lineLabel =
    mutant.endLine > mutant.startLine
      ? `L${mutant.startLine}-L${mutant.endLine}`
      : `L${mutant.startLine}`;
  const titleClass = compact ? "text-base font-semibold" : "text-xl font-semibold tracking-tight";

  return (
    <header className="space-y-2" data-testid="mutant-header">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-muted-foreground text-xs">
            Mutation <span className="font-mono">#{mutant.id}</span>
          </div>
          {canEditTitle ? (
            <EditableTitle mutantId={mutant.id} title={mutant.title} className={titleClass} />
          ) : (
            <h1 className={titleClass}>{mutant.title}</h1>
          )}
        </div>
        {actions}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <ReviewStatusBadge status={mutant.reviewStatus} />
        <MutationStatusBadge status={mutant.mutationStatus} />
        <OperatorBadge operator={mutant.mutationOperator} />
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex min-w-0 items-center gap-1.5">
          <FolderGit2 className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
          <dt className="sr-only">Repository</dt>
          <dd className="flex min-w-0 items-center gap-1">
            <Link href={routes.project(owner, repo)} className="truncate font-mono hover:underline">
              {owner}/{repo}
            </Link>
            <a
              href={routes.github.repo(owner, repo)}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground"
              title="View repository on GitHub"
            >
              <ExternalLink className="size-3" aria-hidden />
            </a>
          </dd>
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <GitCommitHorizontal className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
          <dt className="sr-only">Commit</dt>
          <dd className="flex min-w-0 items-center gap-1">
            <a
              href={routes.github.commit(owner, repo, revision.commitSha)}
              target="_blank"
              rel="noreferrer"
              className="font-mono hover:underline"
              title={`${revision.commitSha}${revision.branch ? ` (${revision.branch})` : ""} — view commit on GitHub`}
            >
              {shortSha(revision.commitSha)}
            </a>
            {revision.branch ? (
              <span className="text-muted-foreground truncate">({revision.branch})</span>
            ) : null}
            <CopyButton
              text={revision.commitSha}
              label=""
              className="text-muted-foreground size-5 p-0"
            />
          </dd>
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <FileCode2 className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
          <dt className="sr-only">File</dt>
          <dd className="flex min-w-0 items-center gap-1">
            <Link
              href={routes.projectCode(owner, repo, mutant.filePath, {
                ref: revision.commitSha,
                line: mutant.startLine,
                endLine: mutant.endLine,
              })}
              className="truncate font-mono hover:underline"
              title={`${mutant.filePath}:${mutant.startLine} at ${shortSha(revision.commitSha)}`}
            >
              {mutant.filePath}
              <span className="text-muted-foreground">:{lineLabel}</span>
            </Link>
            <a
              href={routes.github.file(
                owner,
                repo,
                revision.commitSha,
                mutant.filePath,
                mutant.startLine,
              )}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground"
              title="View file on GitHub"
            >
              <ExternalLink className="size-3" aria-hidden />
            </a>
          </dd>
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <dt className="sr-only">Author</dt>
          <dd className="flex min-w-0 items-center gap-1.5">
            <UserChip user={mutant.createdBy} size="xs" />
            <time
              dateTime={mutant.createdAt.toISOString()}
              title={absoluteDateTime(mutant.createdAt)}
              className="text-muted-foreground"
            >
              {relativeTime(mutant.createdAt)}
            </time>
          </dd>
        </div>
      </dl>
      <p className="text-muted-foreground text-xs">
        Mutant created against commit{" "}
        <span className="font-mono">{shortSha(revision.commitSha)}</span>.
      </p>
    </header>
  );
}
