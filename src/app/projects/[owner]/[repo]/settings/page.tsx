import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { projectService } from "@/server/services/project-service";
import { canManageProject } from "@/domain/auth/permissions";
import { AppError, isAppError } from "@/lib/errors";
import { routes } from "@/lib/routes";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { Section } from "@/components/shared/section";
import { ErrorState } from "@/components/shared/error-states";
import { StatusPill } from "@/components/mutants/status-badge";
import { MemberManager } from "@/components/projects/member-manager";
import { ProjectAdminControls } from "@/components/projects/project-admin-controls";
import { AuditTrail } from "@/components/projects/audit-trail";

export const dynamic = "force-dynamic";

type Params = Promise<{ owner: string; repo: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { owner, repo } = await params;
  return { title: `Settings · ${owner}/${repo}` };
}

export default async function ProjectSettingsPage({ params }: { params: Params }) {
  const { owner, repo } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(routes.signIn(routes.projectSettings(owner, repo)));

  let project;
  try {
    project = await projectService.getBySlugOrThrow(owner, repo);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }

  if (!canManageProject(user, project.id)) {
    return (
      <PageContainer>
        <ErrorState
          error={
            new AppError("FORBIDDEN", "Only maintainers of this project can open its settings.")
          }
          backHref={routes.project(owner, repo)}
          backLabel="Back to project"
        />
      </PageContainer>
    );
  }

  const { members, maintainers, audit } = await projectService.getSettings(user, project);

  return (
    <PageContainer className="space-y-4" wide>
      <div data-testid="project-settings">
        <PageHeader
          eyebrow={
            <span className="inline-flex items-center gap-2">
              <Link href={routes.project(owner, repo)} className="font-mono hover:underline">
                {project.githubOwner}/{project.githubRepository}
              </Link>
              {project.isActive ? (
                <StatusPill tone="success">Active</StatusPill>
              ) : (
                <StatusPill tone="muted">Inactive</StatusPill>
              )}
            </span>
          }
          title="Project settings"
          description="Manage who can review submissions, keep the GitHub metadata current, and pause the project when needed."
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Section
            title="Members"
            description={`${members.length} member${members.length === 1 ? "" : "s"} · ${maintainers} maintainer${maintainers === 1 ? "" : "s"}`}
          >
            <MemberManager
              projectId={project.id}
              owner={project.githubOwner}
              repo={project.githubRepository}
              maintainers={maintainers}
              members={members.map((m) => ({
                userId: m.userId,
                role: m.role,
                user: m.user,
                isYou: m.userId === user.id,
              }))}
            />
          </Section>
        </div>
        <aside className="space-y-4">
          <Section title="Repository" description="Metadata mirrored from GitHub">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-mono">{project.displayName}</dd>
              <dt className="text-muted-foreground">Default branch</dt>
              <dd className="font-mono">{project.defaultBranch}</dd>
              <dt className="text-muted-foreground">Language</dt>
              <dd>{project.language ?? "Unknown"}</dd>
              <dt className="text-muted-foreground">GitHub id</dt>
              <dd className="font-mono">{project.githubRepositoryId ?? "—"}</dd>
              <dt className="text-muted-foreground">Description</dt>
              <dd>{project.description ?? "—"}</dd>
            </dl>
          </Section>
          <Section title="Administration">
            <ProjectAdminControls
              projectId={project.id}
              owner={project.githubOwner}
              repo={project.githubRepository}
              isActive={project.isActive}
            />
          </Section>
          <Section title="Recent changes" description="Audit trail of privileged actions">
            <AuditTrail entries={audit} />
          </Section>
        </aside>
      </div>
    </PageContainer>
  );
}
