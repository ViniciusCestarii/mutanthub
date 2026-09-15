import type { Metadata } from "next";
import Link from "next/link";
import { FolderGit2, Users } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { Section } from "@/components/shared/section";
import { EmptyState } from "@/components/shared/empty-state";
import { RegisterProjectForm } from "@/components/projects/register-project-form";
import { canRegisterProject } from "@/domain/auth/permissions";
import { env } from "@/server/env";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/server/auth/session";
import { projectService } from "@/server/services/project-service";
import { foldStatusCounts } from "@/server/repositories/stats-repository";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Projects" };
export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const [user, projects] = await Promise.all([getCurrentUser(), projectService.listProjects()]);

  return (
    <PageContainer>
      <PageHeader
        title="Projects"
        description="Open-source repositories whose mutants are catalogued here. Every mutant is tied to an exact commit."
      />
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {projects.length === 0 ? (
            <EmptyState
              icon={FolderGit2}
              title="No projects yet"
              description="Register a repository to get started."
            />
          ) : (
            <div className="border-border overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[640px] text-sm" data-testid="project-table">
                <thead className="bg-muted/50 text-muted-foreground text-left text-[11px] tracking-wide uppercase">
                  <tr>
                    <th className="px-3 py-2 font-medium">Repository</th>
                    <th className="px-3 py-2 font-medium">Language</th>
                    <th className="px-3 py-2 text-right font-medium">Mutants</th>
                    <th className="px-3 py-2 text-right font-medium">Surviving</th>
                    <th className="px-3 py-2 text-right font-medium">Killed</th>
                    <th className="px-3 py-2 text-right font-medium">Pending</th>
                    <th className="px-3 py-2 text-right font-medium">People</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {projects.map((p) => {
                    const counts = foldStatusCounts(p.mutants);
                    return (
                      <tr key={p.id} className="hover:bg-muted/40" data-testid="project-row">
                        <td className="max-w-[360px] px-3 py-2">
                          <Link
                            href={routes.project(p.githubOwner, p.githubRepository)}
                            className="font-mono text-sm font-medium hover:underline"
                          >
                            {p.githubOwner}/{p.githubRepository}
                          </Link>
                          <p
                            className="text-muted-foreground truncate text-xs"
                            title={p.description ?? undefined}
                          >
                            {p.description ?? "No description"}
                          </p>
                        </td>
                        <td className="text-muted-foreground px-3 py-2 text-xs">
                          {p.language ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                          {counts.total}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-amber-600 tabular-nums dark:text-amber-400">
                          {counts.surviving}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-emerald-600 tabular-nums dark:text-emerald-400">
                          {counts.killed}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                          {counts.pendingReview}
                        </td>
                        <td className="text-muted-foreground px-3 py-2 text-right text-xs whitespace-nowrap">
                          <span
                            className="inline-flex items-center gap-1"
                            title={`${p._count.members} members, ${p._count.followers} followers`}
                          >
                            <Users className="size-3" aria-hidden />
                            {p._count.members} · {p._count.followers}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <Section
          title="Register repository"
          description="Add a public GitHub repository to the catalogue."
        >
          {user && canRegisterProject(user, env.projectRegistration) ? (
            <RegisterProjectForm />
          ) : user ? (
            <p className="text-muted-foreground text-sm" data-testid="register-admin-only">
              Only administrators can register repositories on this server. Ask an admin to add the
              project, or to make you an administrator.
            </p>
          ) : (
            <div className="text-muted-foreground space-y-3 text-sm">
              <p>Sign in with GitHub to register a repository.</p>
              <Button asChild size="sm" variant="outline">
                <Link href={routes.signIn(routes.projects())}>Sign in</Link>
              </Button>
            </div>
          )}
        </Section>
      </div>
    </PageContainer>
  );
}
