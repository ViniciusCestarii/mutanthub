"use client";

import { useOptimistic, useTransition } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toggleFollowAction } from "@/server/actions/project-actions";

interface FollowButtonProps {
  projectId: string;
  owner: string;
  repo: string;
  following: boolean;
}

export function FollowButton({ projectId, owner, repo, following }: FollowButtonProps) {
  const [optimistic, setOptimistic] = useOptimistic(following);
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      data-testid="follow-button"
      aria-pressed={optimistic}
      onClick={() =>
        startTransition(async () => {
          const next = !optimistic;
          setOptimistic(next);
          const result = await toggleFollowAction(projectId, next, owner, repo);
          if (!result.ok) toast.error(result.error);
        })
      }
    >
      {optimistic ? (
        <BellOff className="size-3.5" aria-hidden />
      ) : (
        <Bell className="size-3.5" aria-hidden />
      )}
      {optimistic ? "Unfollow" : "Follow"}
    </Button>
  );
}
