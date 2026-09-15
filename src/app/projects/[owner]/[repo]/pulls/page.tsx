import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GitPullRequest } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { projectService } from "@/server/services/project-service";
import { pullRequestService } from "@/server/services/pull-request-service";
import { isAppError } from "@/lib/errors";
import { routes } from "@/lib/routes";
import { relativeTime, shortSha } from "@/lib/format";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { Section } from "@/components/shared/section";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusPill } from "@/components/mutants/status-badge";
import { TrackPullRequestForm } from "@/components/pull-requests/track-pull-request-form";
import { PullRequestStateBadge } from "@/components/pull-requests/state-badge";

export const dynamic = "force-dynamic";

type Params = Promise<{ owner: string; repo: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { owner, repo } = await params;
  return { title: `Pull requests · ${owner}/${repo}` };
}

export default async function ProjectPullsPage({ params }: { params: Params }) {
  const { owner, repo } = await params;
  const user = await getCurrentUser();
  let project;
  try {
    project = await projectService.getBySlugOrThrow(owner, repo);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const pulls = await pullRequestService.list(project);

  return (
    <PageContainer className="space-y-4" wide>
      <div data-testid="project-pulls">
        <PageHeader
          eyebrow={
            <Link href={routes.project(owner, repo)} className="font-mono hover:underline">
              {project.githubOwner}/{project.githubRepository}
            </Link>
          }
          title="Pull requests"
          description="Mutants can be scoped to a pull request. Each head commit is recorded as a revision, and a MutantHub check on GitHub summarises the mutants on the changed lines."
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {pulls.length === 0 ? (
            <EmptyState
              icon={GitPullRequest}
              title="No pull requests tracked yet"
              description="Track one by number, or configure the GitHub App webhook to pick up pull requests automatically."
            />
          ) : (
            <div className="border-border overflow-x-auto rounded-lg border">
              <table className="w-full text-sm" data-testid="pull-request-table">
                <thead className="bg-muted/50 text-muted-foreground text-left text-[11px] tracking-wide uppercase">
                  <tr>
                    <th className="px-3 py-2 font-medium">Pull request</th>
                    <th className="px-3 py-2 font-medium">State</th>
                    <th className="px-3 py-2 font-medium">Head</th>
                    <th className="px-3 py-2 font-medium">Files</th>
                    <th className="px-3 py-2 font-medium">Mutants</th>
                    <th className="px-3 py-2 font-medium">Synced</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {pulls.map((pr) => (
                    <tr key={pr.id} className="hover:bg-muted/40" data-testid="pull-request-row">
                      <td className="max-w-[420px] px-3 py-2">
                        <Link
                          href={routes.projectPull(owner, repo, pr.number)}
                          className="block truncate font-medium hover:underline"
                        >
                          <span className="text-muted-foreground font-mono text-xs">
                            #{pr.number}
                          </span>{" "}
                          {pr.title}
                        </Link>
                        <span className="text-muted-foreground text-xs">
                          {pr.authorLogin ? `@${pr.authorLogin} · ` : ""}
                          <span className="font-mono">{pr.headRef}</span> into{" "}
                          <span className="font-mono">{pr.baseRef}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <PullRequestStateBadge state={pr.state} />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{shortSha(pr.headSha)}</td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap">
                        {pr.changedFiles} ·{" "}
                        <span className="text-emerald-600 dark:text-emerald-400">
                          +{pr.additions}
                        </span>{" "}
                        <span className="text-rose-600 dark:text-rose-400">-{pr.deletions}</span>
                      </td>
                      <td className="px-3 py-2">
                        <StatusPill tone={pr._count.mutants ? "warning" : "muted"} dot={false}>
                          {pr._count.mutants}
                        </StatusPill>
                      </td>
                      <td className="text-muted-foreground px-3 py-2 text-xs whitespace-nowrap">
                        {relativeTime(pr.lastSyncedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <aside>
          <Section title="Track a pull request">
            {user ? (
              <TrackPullRequestForm
                projectId={project.id}
                owner={project.githubOwner}
                repo={project.githubRepository}
              />
            ) : (
              <p className="text-muted-foreground text-xs">
                <Link href={routes.signIn(routes.projectPulls(owner, repo))} className="underline">
                  Sign in
                </Link>{" "}
                to track a pull request.
              </p>
            )}
          </Section>
        </aside>
      </div>
    </PageContainer>
  );
}
