import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { PageContainer } from "@/components/shared/page-header";
import { Section } from "@/components/shared/section";
import { Stat } from "@/components/shared/stat";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { MutantTable } from "@/components/mutants/mutant-table";
import { StatusPill } from "@/components/mutants/status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { userService } from "@/server/services/user-service";
import { isAppError } from "@/lib/errors";
import { routes } from "@/lib/routes";
import { absoluteDate } from "@/lib/format";

type Params = Promise<{ username: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username}` };
}

export default async function UserProfilePage({ params }: { params: Params }) {
  const { username } = await params;

  let profile;
  try {
    profile = await userService.getProfile(username);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const { user, counts } = profile;

  return (
    <PageContainer wide>
      <div data-testid="profile">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Avatar className="size-16">
            <AvatarImage src={user.avatarUrl ?? undefined} alt="" />
            <AvatarFallback>{user.githubUsername.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight">{user.displayName}</h1>
            <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <a
                href={routes.github.user(user.githubUsername)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono hover:underline"
              >
                @{user.githubUsername}
                <ExternalLink className="size-3" aria-hidden />
              </a>
              {user.globalRole === "ADMIN" ? (
                <StatusPill tone="info" dot={false}>
                  admin
                </StatusPill>
              ) : null}
              <span>Joined {absoluteDate(user.createdAt)}</span>
            </div>
            {user.bio ? <p className="mt-2 max-w-2xl text-sm">{user.bio}</p> : null}
            {profile.memberships.length ? (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {profile.memberships.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={routes.project(m.project.githubOwner, m.project.githubRepository)}
                      className="border-border hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs"
                    >
                      <span className="font-mono">
                        {m.project.githubOwner}/{m.project.githubRepository}
                      </span>
                      <span className="text-muted-foreground">{m.role.toLowerCase()}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Submitted" value={counts.total} />
          <Stat label="Approved" value={counts.approved} tone="success" />
          <Stat label="Surviving" value={counts.surviving} tone="warning" />
          <Stat label="Killed" value={counts.killed} tone="success" />
          <Stat label="Equivalent" value={counts.equivalent} tone="info" />
          <Stat
            label="Validations"
            value={profile.validationsPerformed}
            hint="reproductions performed"
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Section
            title="Recent mutants"
            className="lg:col-span-2"
            description={profile.totalMutants ? `${profile.totalMutants} total` : undefined}
            actions={
              profile.totalMutants > 0 ? (
                <Button asChild variant="ghost" size="xs">
                  <Link
                    href={`${routes.mutants()}?contributor=${encodeURIComponent(user.githubUsername)}`}
                  >
                    View all
                  </Link>
                </Button>
              ) : undefined
            }
          >
            <MutantTable mutants={profile.recentMutants} emptyTitle="No mutants submitted yet" />
          </Section>
          <Section title="Recent activity">
            <ActivityFeed items={profile.recentActivity} />
          </Section>
        </div>
      </div>
    </PageContainer>
  );
}
