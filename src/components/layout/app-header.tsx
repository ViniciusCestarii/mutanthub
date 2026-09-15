import Link from "next/link";
import { Dna, Search } from "lucide-react";
import { routes } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu, type HeaderUser } from "./user-menu";
import { NavLinks } from "./nav-links";
import { MobileNav } from "./mobile-nav";
import {
  NotificationsMenu,
  type HeaderNotification,
} from "@/components/notifications/notifications-menu";

interface AppHeaderProps {
  user: HeaderUser | null;
  isReviewer: boolean;
  reviewCount: number;
  notifications: { unread: number; latest: HeaderNotification[] };
}

export function AppHeader({ user, isReviewer, reviewCount, notifications }: AppHeaderProps) {
  return (
    <header className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-12 max-w-[1600px] items-center gap-3 px-3 sm:px-4">
        <MobileNav user={user} isReviewer={isReviewer} reviewCount={reviewCount} />
        <Link href={routes.home()} className="flex items-center gap-2 font-semibold tracking-tight">
          <Dna className="text-primary size-4" aria-hidden />
          <span>MutantHub</span>
        </Link>
        <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Main">
          <NavLinks user={user} isReviewer={isReviewer} reviewCount={reviewCount} />
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link href="/search">
              <Search className="size-4" aria-hidden />
              <span className="hidden sm:inline">Search</span>
              <kbd className="border-border bg-muted text-muted-foreground ml-1 hidden rounded border px-1 font-mono text-[10px] lg:inline">
                /
              </kbd>
            </Link>
          </Button>
          {user ? (
            <NotificationsMenu unread={notifications.unread} latest={notifications.latest} />
          ) : null}
          <ThemeToggle />
          {user ? (
            <UserMenu user={user} />
          ) : (
            <Button asChild size="sm" data-testid="header-sign-in">
              <Link href={routes.signIn()}>Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
