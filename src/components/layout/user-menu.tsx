"use client";

import Link from "next/link";
import { LogOut, Settings, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";
import { signOutAction } from "@/server/actions/auth-actions";

export interface HeaderUser {
  githubUsername: string;
  displayName: string;
  avatarUrl: string | null;
  isAdmin: boolean;
}

export function UserMenu({ user }: { user: HeaderUser }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
          data-testid="user-menu"
          aria-label="Account menu"
        >
          <Avatar className="size-7">
            <AvatarImage src={user.avatarUrl ?? undefined} alt="" />
            <AvatarFallback>{user.githubUsername.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate font-medium">{user.displayName}</span>
          <span className="text-muted-foreground truncate font-mono text-xs">
            @{user.githubUsername}
          </span>
          {user.isAdmin ? (
            <span className="text-muted-foreground mt-1 text-[10px] tracking-wide uppercase">
              Admin
            </span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={routes.user(user.githubUsername)}>
            <User className="size-4" aria-hidden /> Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={routes.settings()}>
            <Settings className="size-4" aria-hidden /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOutAction()} data-testid="sign-out">
          <LogOut className="size-4" aria-hidden /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
