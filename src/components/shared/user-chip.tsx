import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

interface UserChipProps {
  user: { githubUsername: string; displayName?: string | null; avatarUrl?: string | null };
  size?: "xs" | "sm" | "md";
  showName?: boolean;
  className?: string;
  /** Render as plain text (no anchor) when the chip already sits inside a link. */
  asLink?: boolean;
}

const SIZE = { xs: "size-4", sm: "size-5", md: "size-7" } as const;

export function UserChip({
  user,
  size = "sm",
  showName = false,
  className,
  asLink = true,
}: UserChipProps) {
  const content = (
    <>
      <Avatar className={SIZE[size]}>
        <AvatarImage src={user.avatarUrl ?? undefined} alt="" />
        <AvatarFallback className="text-[9px]">
          {user.githubUsername.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="font-mono text-xs">@{user.githubUsername}</span>
      {showName && user.displayName ? (
        <span className="text-muted-foreground">{user.displayName}</span>
      ) : null}
    </>
  );
  const classes = cn(
    "inline-flex items-center gap-1.5 text-sm",
    asLink && "hover:underline",
    className,
  );
  if (!asLink) return <span className={classes}>{content}</span>;
  return (
    <Link href={routes.user(user.githubUsername)} className={classes}>
      {content}
    </Link>
  );
}
