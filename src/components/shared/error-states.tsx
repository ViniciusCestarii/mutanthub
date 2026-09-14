import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  FileX,
  GitCommitHorizontal,
  Lock,
  ServerCrash,
  WifiOff,
} from "lucide-react";
import { isGitHubError } from "@/server/github/types";
import { isAppError } from "@/lib/errors";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

interface Props {
  error: unknown;
  /** Where "Go back" should lead. */
  backHref?: string;
  backLabel?: string;
  compact?: boolean;
}

/**
 * Maps GitHub / application errors to polished empty states. Used by pages
 * that talk to the GitHub API (repository unavailable, rate limits, missing
 * commit or file) and by pages that enforce permissions.
 */
export function ErrorState({ error, backHref, backLabel = "Go back", compact }: Props) {
  const action = backHref ? (
    <Button asChild variant="outline" size="sm">
      <Link href={backHref}>{backLabel}</Link>
    </Button>
  ) : undefined;

  if (isGitHubError(error)) {
    switch (error.kind) {
      case "RATE_LIMITED":
        return (
          <EmptyState
            compact={compact}
            icon={Clock}
            title="GitHub API rate limit reached"
            description={
              error.resetAt
                ? `Requests to GitHub are temporarily limited. The limit resets at ${error.resetAt.toLocaleTimeString()}. Configure GITHUB_TOKEN to raise the limit.`
                : "Requests to GitHub are temporarily limited. Configure GITHUB_TOKEN to raise the limit."
            }
            action={action}
          />
        );
      case "NOT_FOUND":
        return (
          <EmptyState
            compact={compact}
            icon={FileX}
            title="Not found on GitHub"
            description="The commit, directory or file does not exist at this revision. It may have been removed or renamed."
            action={action}
          />
        );
      case "NETWORK":
        return (
          <EmptyState
            compact={compact}
            icon={WifiOff}
            title="Network failure"
            description="Could not reach the GitHub API. Check your connection and try again."
            action={action}
          />
        );
      case "UNAUTHORIZED":
        return (
          <EmptyState
            compact={compact}
            icon={Lock}
            title="GitHub refused the request"
            description="The configured GitHub token is invalid or lacks permission to read this repository."
            action={action}
          />
        );
      case "TOO_LARGE":
        return (
          <EmptyState
            compact={compact}
            icon={FileX}
            title="File too large to display"
            description={error.message}
            action={action}
          />
        );
      default:
        return (
          <EmptyState
            compact={compact}
            icon={ServerCrash}
            title="Repository unavailable"
            description="GitHub returned an error while loading this repository. Please try again later."
            action={action}
          />
        );
    }
  }

  if (isAppError(error)) {
    if (error.code === "FORBIDDEN" || error.code === "UNAUTHENTICATED") {
      return (
        <EmptyState
          compact={compact}
          icon={Lock}
          title="Permission denied"
          description={error.message}
          action={
            error.code === "UNAUTHENTICATED" ? (
              <Button asChild size="sm">
                <Link href={routes.signIn()}>Sign in</Link>
              </Button>
            ) : (
              action
            )
          }
        />
      );
    }
    if (error.code === "NOT_FOUND") {
      return (
        <EmptyState
          compact={compact}
          icon={GitCommitHorizontal}
          title={error.message}
          action={action}
        />
      );
    }
  }

  return (
    <EmptyState
      compact={compact}
      icon={AlertTriangle}
      title="Something went wrong"
      description={error instanceof Error ? error.message : "Unexpected error"}
      action={action}
    />
  );
}
