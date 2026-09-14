import Link from "next/link";
import { ArrowRight, Code2, FlaskConical, GitPullRequestArrow, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Stat } from "@/components/shared/stat";
import { Section } from "@/components/shared/section";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { GitHubIcon } from "@/components/shared/github-icon";
import { getCurrentUser } from "@/server/auth/session";
import { statsRepository } from "@/server/repositories/stats-repository";
import { projectRepository } from "@/server/repositories/project-repository";
import { dashboardService } from "@/server/services/dashboard-service";
import { routes } from "@/lib/routes";
import { relativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    icon: Code2,
    title: "Explore real code",
    body: "Browse registered open-source repositories at an exact commit in a read-only, IDE-like viewer.",
  },
  {
    icon: FlaskConical,
    title: "Submit surviving mutants",
    body: "Pick a line, describe the mutation as a git diff and record how you built and tested it.",
  },
  {
    icon: GitPullRequestArrow,
    title: "Reproduce results",
    body: "Other contributors re-run the mutant in their environment and report what they observed.",
  },
  {
    icon: Target,
    title: "Kill mutants with better tests",
    body: "Discuss equivalence, find the missing test and record when a mutant is finally killed.",
  },
];

export default async function LandingPage() {
  const [user, totals, counts, activity, projects] = await Promise.all([
    getCurrentUser(),
    statsRepository.platformTotals(),
    statsRepository.globalCounts(),
    dashboardService.getPublicActivity(10),
    projectRepository.list({ activeOnly: true }),
  ]);
  const recentProjects = [...projects]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <section className="py-16 sm:py-24">
        <p className="text-muted-foreground mb-3 font-mono text-xs tracking-wide uppercase">
          Collaborative mutation testing
        </p>
        <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">
          Find the mutants tests couldn&apos;t kill.
        </h1>
        <p className="text-muted-foreground mt-4 max-w-2xl text-base sm:text-lg">
          A collaborative platform for discovering, reproducing and investigating surviving software
          mutants.
        </p>
        <div className="mt-8 flex flex-wrap gap-2">
          <Button asChild size="lg" data-testid="landing-cta-explore">
            <Link href={routes.mutants()}>
              Explore mutants <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
          {user ? (
            <Button asChild size="lg" variant="outline">
              <Link href={routes.dashboard()}>Go to dashboard</Link>
            </Button>
          ) : (
            <Button asChild size="lg" variant="outline" data-testid="landing-cta-sign-in">
              <Link href={routes.signIn()}>
                <GitHubIcon className="size-4" /> Sign in with GitHub
              </Link>
            </Button>
          )}
        </div>
        <p className="text-muted-foreground mt-6 max-w-2xl text-sm">
          A surviving mutant is not automatically a weakness in the test suite: it may be
          equivalent, invalid or environment-dependent. MutantHub exists to investigate each one
          carefully.
        </p>
      </section>

      <section className="border-border grid grid-cols-1 gap-3 border-t py-10 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, i) => (
          <div key={step.title} className="border-border bg-card rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-mono text-xs">0{i + 1}</span>
              <step.icon className="text-primary size-4" aria-hidden />
            </div>
            <h2 className="mt-3 text-sm font-semibold">{step.title}</h2>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{step.body}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-2 gap-3 py-6 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Projects" value={totals.projects} />
        <Stat label="Mutants" value={totals.mutants} />
        <Stat label="Surviving" value={counts.surviving} tone="warning" />
        <Stat label="Killed" value={counts.killed} tone="success" />
        <Stat label="Reproductions" value={totals.validations} />
        <Stat label="Contributors" value={totals.users} />
      </section>

      <section className="grid grid-cols-1 gap-4 py-6 pb-16 lg:grid-cols-5">
        <Section title="Recent activity" className="lg:col-span-3">
          <ActivityFeed items={activity} />
        </Section>
        <Section
          title="Recently registered projects"
          className="lg:col-span-2"
          actions={
            <Button asChild variant="ghost" size="xs">
              <Link href={routes.projects()}>All projects</Link>
            </Button>
          }
        >
          {recentProjects.length === 0 ? (
            <p className="text-muted-foreground text-sm">No projects registered yet.</p>
          ) : (
            <ul className="divide-border divide-y">
              {recentProjects.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <Link
                      href={routes.project(p.githubOwner, p.githubRepository)}
                      className="font-mono text-sm hover:underline"
                    >
                      {p.githubOwner}/{p.githubRepository}
                    </Link>
                    <p className="text-muted-foreground truncate text-xs">
                      {p.description ?? "No description"}
                    </p>
                  </div>
                  <div className="text-muted-foreground shrink-0 text-right text-xs">
                    <div className="font-mono">{p._count.mutants} mutants</div>
                    <div>{relativeTime(p.createdAt)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </section>
    </main>
  );
}
