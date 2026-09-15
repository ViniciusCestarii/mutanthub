"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import {
  markAllNotificationsReadAction,
  openNotificationAction,
} from "@/server/actions/notification-actions";

export interface HeaderNotification {
  id: string;
  title: string;
  body: string | null;
  read: boolean;
  createdAtLabel: string;
  actor: { githubUsername: string; avatarUrl: string | null } | null;
}

interface NotificationsMenuProps {
  unread: number;
  latest: HeaderNotification[];
}

/** Header bell with unread badge and a popover listing the latest notifications. */
export function NotificationsMenu({ unread, latest }: NotificationsMenuProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative"
          aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
          data-testid="notifications-bell"
          data-unread={unread}
        >
          <Bell className="size-4" aria-hidden />
          {unread > 0 ? (
            <span
              className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 min-w-4 rounded-full px-1 text-center font-mono text-[10px] leading-4"
              data-testid="notifications-count"
            >
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" data-testid="notifications-menu">
        <div className="border-border flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={pending || unread === 0}
            onClick={() =>
              startTransition(async () => {
                const result = await markAllNotificationsReadAction();
                if (!result.ok) toast.error(result.error);
                router.refresh();
              })
            }
            data-testid="notifications-mark-all"
          >
            <CheckCheck className="size-3.5" aria-hidden /> Mark all read
          </Button>
        </div>
        {latest.length === 0 ? (
          <p className="text-muted-foreground px-3 py-6 text-center text-xs">
            Nothing yet. You will hear about reviews, reproductions and comments on your mutants.
          </p>
        ) : (
          <ul className="divide-border max-h-96 divide-y overflow-y-auto">
            {latest.map((n) => (
              <li key={n.id}>
                <form action={openNotificationAction}>
                  <input type="hidden" name="id" value={n.id} />
                  <button
                    type="submit"
                    className={cn(
                      "hover:bg-muted/60 flex w-full flex-col gap-0.5 px-3 py-2 text-left",
                      !n.read && "bg-primary/5",
                    )}
                    data-testid="notification-item"
                    data-read={n.read}
                  >
                    <span className="flex items-start gap-2">
                      <span
                        className={cn(
                          "mt-1.5 size-1.5 shrink-0 rounded-full",
                          n.read ? "bg-transparent" : "bg-primary",
                        )}
                        aria-hidden
                      />
                      <span className="text-xs leading-snug font-medium">{n.title}</span>
                    </span>
                    {n.body ? (
                      <span className="text-muted-foreground line-clamp-2 pl-3.5 text-[11px]">
                        {n.body}
                      </span>
                    ) : null}
                    <span className="text-muted-foreground pl-3.5 text-[10px]">
                      {n.createdAtLabel}
                    </span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <div className="border-border border-t px-3 py-2 text-center">
          <Link
            href={routes.notifications()}
            className="text-xs underline underline-offset-2"
            onClick={() => setOpen(false)}
          >
            View all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
