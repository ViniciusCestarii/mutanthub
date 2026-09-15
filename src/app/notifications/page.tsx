import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { notificationService } from "@/server/services/notification-service";
import {
  markAllNotificationsReadAction,
  openNotificationAction,
} from "@/server/actions/notification-actions";
import { routes } from "@/lib/routes";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; filter?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(routes.signIn(routes.notifications()));
  const params = await searchParams;
  const unreadOnly = params.filter === "unread";
  const { items, total, unread, page, pageSize } = await notificationService.listPage(
    user,
    Number(params.page ?? "1"),
    unreadOnly,
  );

  const hrefFor = (p: number) =>
    `${routes.notifications()}?${new URLSearchParams({
      ...(unreadOnly ? { filter: "unread" } : {}),
      page: String(p),
    }).toString()}`;

  return (
    <PageContainer className="max-w-3xl space-y-4">
      <PageHeader
        title="Notifications"
        description={`${unread} unread`}
        actions={
          <form
            action={async () => {
              "use server";
              await markAllNotificationsReadAction();
            }}
          >
            <Button type="submit" variant="outline" size="sm" disabled={unread === 0}>
              <CheckCheck className="size-3.5" aria-hidden /> Mark all read
            </Button>
          </form>
        }
      />

      <div className="flex gap-1 text-sm" data-testid="notifications-page">
        <Button asChild variant={unreadOnly ? "ghost" : "secondary"} size="sm">
          <Link href={routes.notifications()}>All</Link>
        </Button>
        <Button asChild variant={unreadOnly ? "secondary" : "ghost"} size="sm">
          <Link href={`${routes.notifications()}?filter=unread`}>Unread</Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={unreadOnly ? "No unread notifications" : "No notifications yet"}
          description="You will be notified about reviews, reproductions and comments on mutants you are involved in, and about new submissions in projects you review."
        />
      ) : (
        <ul className="border-border divide-border divide-y rounded-lg border">
          {items.map((n) => (
            <li key={n.id}>
              <form action={openNotificationAction}>
                <input type="hidden" name="id" value={n.id} />
                <button
                  type="submit"
                  className={cn(
                    "hover:bg-muted/50 flex w-full items-start gap-3 px-4 py-3 text-left",
                    !n.readAt && "bg-primary/5",
                  )}
                  data-testid="notification-row"
                  data-read={Boolean(n.readAt)}
                >
                  <Avatar className="mt-0.5 size-6">
                    <AvatarImage src={n.actor?.avatarUrl ?? undefined} alt="" />
                    <AvatarFallback className="text-[9px]">
                      {n.actor?.githubUsername.slice(0, 2).toUpperCase() ?? "MH"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm", !n.readAt && "font-medium")}>
                      {n.title}
                    </span>
                    {n.body ? (
                      <span className="text-muted-foreground line-clamp-2 block text-xs">
                        {n.body}
                      </span>
                    ) : null}
                    <span className="text-muted-foreground mt-0.5 flex flex-wrap gap-x-2 text-[11px]">
                      {n.project ? (
                        <span className="font-mono">
                          {n.project.githubOwner}/{n.project.githubRepository}
                        </span>
                      ) : null}
                      {n.mutant ? (
                        <span className="font-mono">
                          {n.mutant.filePath}:{n.mutant.startLine}
                        </span>
                      ) : null}
                      <time dateTime={n.createdAt.toISOString()}>{relativeTime(n.createdAt)}</time>
                    </span>
                  </span>
                  {!n.readAt ? (
                    <span className="bg-primary mt-2 size-2 shrink-0 rounded-full" aria-hidden />
                  ) : null}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <Pagination page={page} pageSize={pageSize} total={total} hrefFor={hrefFor} />
    </PageContainer>
  );
}
