import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Eye, Lock } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { Section } from "@/components/shared/section";
import { StatusPill } from "@/components/mutants/status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getCurrentUser } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect(routes.signIn(routes.settings()));

  const memberships = await prisma.projectMember.findMany({
    where: { userId: user.id },
    include: {
      project: { select: { id: true, githubOwner: true, githubRepository: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <PageContainer>
      <PageHeader title="Settings" description="Your account as seen by MutantHub." />
      <div className="mt-6 space-y-4">
        <Section
          title="Account"
          description="Profile data is synchronised from GitHub on every sign-in; it cannot be edited here in this version."
        >
          <div className="flex items-start gap-4">
            <Avatar className="size-14">
              <AvatarImage src={user.avatarUrl ?? undefined} alt="" />
              <AvatarFallback>{user.githubUsername.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Display name</dt>
              <dd>{user.displayName}</dd>
              <dt className="text-muted-foreground">Username</dt>
              <dd className="font-mono">@{user.githubUsername}</dd>
              <dt className="text-muted-foreground">Email</dt>
              <dd>{user.email ?? <span className="text-muted-foreground">not shared</span>}</dd>
              <dt className="text-muted-foreground">Global role</dt>
              <dd>
                <StatusPill tone={user.globalRole === "ADMIN" ? "info" : "muted"} dot={false}>
                  {user.globalRole.toLowerCase()}
                </StatusPill>
              </dd>
            </dl>
          </div>
        </Section>

        <Section
          title="Project roles"
          description="Roles are granted by project maintainers or administrators."
        >
          {memberships.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              You are a contributor on every project and a reviewer on none.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-left text-[11px] tracking-wide uppercase">
                <tr>
                  <th className="py-1 font-medium">Project</th>
                  <th className="py-1 font-medium">Role</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {memberships.map((m) => (
                  <tr key={m.id}>
                    <td className="py-1.5">
                      <Link
                        href={routes.project(m.project.githubOwner, m.project.githubRepository)}
                        className="font-mono hover:underline"
                      >
                        {m.project.githubOwner}/{m.project.githubRepository}
                      </Link>
                    </td>
                    <td className="py-1.5 text-xs">{m.role.toLowerCase()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="Integrations">
          <div className="flex items-start gap-3 text-sm">
            <Lock className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
            <div>
              <div className="font-medium">GitHub (read-only)</div>
              <p className="text-muted-foreground">
                MutantHub only requests your public profile and email. It never asks for write
                access to repositories and never executes the build or test commands you submit.
              </p>
            </div>
          </div>
        </Section>

        <Section title="Public data">
          <div className="flex items-start gap-3 text-sm">
            <Eye className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
            <ul className="text-muted-foreground list-disc space-y-1 pl-4">
              <li>
                Your{" "}
                <Link href={routes.user(user.githubUsername)} className="underline">
                  profile
                </Link>
                : avatar, username, display name and statistics.
              </li>
              <li>
                Every mutant, submission, reproduction and comment you create, including the
                commands and environment you describe.
              </li>
              <li>Mutant data may later be published as an open research dataset.</li>
            </ul>
          </div>
        </Section>
      </div>
    </PageContainer>
  );
}
