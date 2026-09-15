import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Code2, ExternalLink, RefreshCw } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { projectService } from "@/server/services/project-service";
import { pullRequestService } from "@/server/services/pull-request-service";
import { syncPullRequestAction } from "@/server/actions/pull-request-actions";
import { isAppError } from "@/lib/errors";
import { routes } from "@/lib/routes";
import { absoluteDateTime, relativeTime, shortSha } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { Section } from "@/components/shared/section";
import { Stat } from "@/components/shared/stat";
import { EmptyState } from "@/components/shared/empty-state";
import { MutantTable } from "@/components/mutants/mutant-table";
import { PullRequestStateBadge } from "@/components/pull-requests/state-badge";
import { Bug } from "lucide-react";

export const dynamic = "force-dynamic";

type Params = Promise<{ owner: string; repo: string; number: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { owner, repo, number } = await params;
  return { title: `PR #${number} · ${owner}/${repo}` };
}

export default async function PullRequestPage({ params }: { params: Params }) {
  const { owner, repo, number: rawNumber } = await params;
  const number = Number(rawNumber);
  if (!Number.isInteger(number) || number <= 0) notFound();
  const user = await getCurrentUser();

  let project;
  let detail;
  try {
    project = await projectService.getBySlugOrThrow(owner, repo);
    detail = await pullRequestService.getDetail(project, number);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const { pr, mutants, onDiff, files } = detail;
  const offDiff = mutants.length - onDiff.length;
  const surviving = onDiff.filter((m) => m.mutationStatus === "SURVIVED").length;
  const killed = onDiff.filter((m) => m.mutationStatus === "KILLED").length;
  const pending = onDiff.filter(
    (m) => m.reviewStatus === "PENDING" || m.reviewStatus === "NEEDS_INFORMATION",
  ).length;

  return (
    <PageContainer className="space-y-4" wide>
      <div data-testid="pull-request-page">
        <PageHeader
          eyebrow={
            <span className="inline-flex flex-wrap items-center gap-2">
              <Link href={routes.projectPulls(owner, repo)} className="font-mono hover:underline">
                {project.githubOwner}/{project.githubRepository} · pull requests
              </Link>
              <PullRequestStateBadge state={pr.state} />
            </span>
          }
          title={
            <>
              <span className="text-muted-foreground font-mono">#{pr.number}</span> {pr.title}
            </>
          }
          description={
            <>
              {pr.authorLogin ? (
                <>
                  by <span className="font-mono">@{pr.authorLogin}</span> ·{" "}
                </>
              ) : null}
              <span className="font-mono">{pr.headRef}</span> into{" "}
              <span className="font-mono">{pr.baseRef}</span> · head{" "}
              <span className="font-mono">{shortSha(pr.headSha)}</span> · synced{" "}
              <span title={absoluteDateTime(pr.lastSyncedAt)}>{relativeTime(pr.lastSyncedAt)}</span>
            </>
          }
          actions={
            <>
              {user ? (
                <form action={syncPullRequestAction}>
                  <input type="hidden" name="owner" value={owner} />
                  <input type="hidden" name="repo" value={repo} />
                  <input type="hidden" name="number" value={pr.number} />
                  <Button type="submit" variant="outline" size="sm" data-testid="sync-pull-request">
                    <RefreshCw className="size-3.5" aria-hidden /> Sync from GitHub
                  </Button>
                </form>
              ) : null}
              <Button asChild variant="outline" size="sm">
                <a href={pr.htmlUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-3.5" aria-hidden /> View on GitHub
                </a>
              </Button>
            </>
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Mutants on diff" value={onDiff.length} />
        <Stat label="Surviving" value={surviving} tone={surviving ? "warning" : "default"} />
        <Stat label="Killed" value={killed} tone={killed ? "success" : "default"} />
        <Stat label="Pending review" value={pending} tone={pending ? "info" : "default"} />
        <Stat
          label="Changed files"
          value={pr.changedFiles}
          hint={`+${pr.additions} / -${pr.deletions}`}
        />
      </div>

      <p className="text-muted-foreground text-xs">
        A surviving mutant means the recorded tests did not detect it. It may be equivalent,
        environment-dependent, or not reproduced yet. The MutantHub check on GitHub carries the same
        summary and never blocks a merge.
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Section
            title="Mutants on changed lines"
            description={`${onDiff.length} recorded against this pull request`}
          >
            <MutantTable
              mutants={onDiff}
              showProject={false}
              emptyTitle="No mutants on the changed lines yet"
              emptyDescription="Open a changed file in pull request mode and suggest a mutant on a highlighted line."
            />
          </Section>
          {offDiff > 0 ? (
            <Section
              title="Other mutants recorded on this pull request"
              description="Outside the changed lines"
            >
              <MutantTable
                mutants={mutants.filter((m) => !onDiff.includes(m))}
                showProject={false}
              />
            </Section>
          ) : null}
        </div>
        <aside className="space-y-4">
          <Section title="Changed files" description="Open in pull request mode">
            {files.length === 0 ? (
              <EmptyState icon={Bug} title="No changed files with additions" compact />
            ) : (
              <ul className="space-y-1.5 text-xs" data-testid="pull-request-files">
                {files.map((f) => (
                  <li key={f.path} className="flex items-center justify-between gap-2">
                    <Link
                      href={routes.projectCode(owner, repo, f.path, {
                        ref: pr.headSha,
                        pr: pr.number,
                        line: f.ranges[0]?.[0],
                      })}
                      className="min-w-0 truncate font-mono hover:underline"
                      title={f.path}
                    >
                      <Code2 className="mr-1 inline size-3 align-text-bottom" aria-hidden />
                      {f.path}
                    </Link>
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">
                      {f.changedLines} lines · {f.mutants} mutant{f.mutants === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </aside>
      </div>
    </PageContainer>
  );
}
