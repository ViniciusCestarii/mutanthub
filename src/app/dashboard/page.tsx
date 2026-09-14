import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ClipboardCheck, FolderGit2, FlaskConical } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { Section } from "@/components/shared/section";
import { Stat } from "@/components/shared/stat";
import { EmptyState } from "@/components/shared/empty-state";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { MutantTable } from "@/components/mutants/mutant-table";
import { MutationStatusBadge } from "@/components/mutants/status-badge";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/server/auth/session";
import { dashboardService } from "@/server/services/dashboard-service";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect(routes.signIn(routes.dashboard()));

  const data = await dashboardService.getDashboard(user);

  return (
    <PageContainer wide>
      <div data-testid="dashboard">
        <PageHeader
          title={`Welcome back, ${user.displayName}`}
          description="Your submissions, reviews and suggested reproductions."
          actions={
            <Button asChild variant="outline" size="sm">
              <Link href={routes.projects()}>
                <FolderGit2 className="size-3.5" aria-hidden /> Browse projects
              </Link>
            </Button>
          }
        />

        {data.isReviewer ? (
          <Link
            href={routes.review()}
            data-testid="dashboard-review-queue"
            className="border-primary/30 bg-primary/5 hover:bg-primary/10 mt-5 flex items-center justify-between gap-3 rounded-lg border px-4 py-3 transition-colors"
          >
            <div className="flex items-center gap-3">
              <ClipboardCheck className="text-primary size-5" aria-hidden />
              <div>
                <div className="text-sm font-semibold">Review queue</div>
                <div className="text-muted-foreground text-xs">
                  {data.reviewQueueCount === 0
                    ? "Nothing waiting for review"
                    : `${data.reviewQueueCount} submission${data.reviewQueueCount === 1 ? "" : "s"} waiting for review`}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-2xl font-semibold tabular-nums">
                {data.reviewQueueCount}
              </span>
              <ArrowRight className="text-muted-foreground size-4" aria-hidden />
            </div>
          </Link>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Submitted" value={data.counts.total} />
          <Stat label="Approved" value={data.counts.approved} tone="success" />
          <Stat label="Surviving" value={data.counts.surviving} tone="warning" />
          <Stat label="Killed" value={data.counts.killed} tone="success" />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Section
              title="Your submissions"
              description={data.totalSubmissions ? `${data.totalSubmissions} total` : undefined}
              actions={
                <Button asChild variant="ghost" size="xs">
                  <Link
                    href={`${routes.mutants()}?contributor=${encodeURIComponent(user.githubUsername)}`}
                  >
                    View all
                  </Link>
                </Button>
              }
            >
              <MutantTable
                mutants={data.submissions}
                emptyTitle="You have not submitted any mutants yet"
                emptyDescription="Open a project, browse to a file, select a line and click Suggest mutant."
              />
            </Section>

            <Section
              title="Pending reviews"
              description="Your mutants that are still waiting for moderation."
            >
              <MutantTable mutants={data.pendingReviews} emptyTitle="Nothing pending" />
            </Section>

            <Section
              title="Recent activity"
              description="What others did on mutants you submitted, reproduced or discussed."
            >
              <ActivityFeed items={data.activity} emptyTitle="No activity on your mutants yet" />
            </Section>
          </div>

          <div className="space-y-4">
            <Section
              title="Suggested mutants to reproduce"
              description="Approved mutants with few reproductions."
            >
              {data.suggested.length === 0 ? (
                <EmptyState icon={FlaskConical} title="Nothing to suggest right now" compact />
              ) : (
                <ul className="divide-border divide-y">
                  {data.suggested.map((m) => (
                    <li key={m.id} className="py-2 text-sm">
                      <Link
                        href={routes.mutant(m.id)}
                        className="block truncate font-medium hover:underline"
                        title={m.title}
                      >
                        <span className="text-muted-foreground font-mono text-xs">#{m.id}</span>{" "}
                        {m.title}
                      </Link>
                      <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        <span className="font-mono">
                          {m.project.githubOwner}/{m.project.githubRepository}
                        </span>
                        <span className="truncate font-mono">
                          {m.filePath}:{m.startLine}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <MutationStatusBadge status={m.mutationStatus} />
                        <span className="text-muted-foreground text-xs">
                          {m._count.validations} reproduction{m._count.validations === 1 ? "" : "s"}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Projects you follow">
              {data.followedProjects.length === 0 ? (
                <EmptyState
                  icon={FolderGit2}
                  title="Not following any project"
                  compact
                  action={
                    <Button asChild variant="outline" size="xs">
                      <Link href={routes.projects()}>Find projects</Link>
                    </Button>
                  }
                />
              ) : (
                <ul className="space-y-1">
                  {data.followedProjects.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={routes.project(p.githubOwner, p.githubRepository)}
                        className="font-mono text-sm hover:underline"
                      >
                        {p.githubOwner}/{p.githubRepository}
                      </Link>
                      {p.language ? (
                        <span className="text-muted-foreground ml-2 text-xs">{p.language}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
