"use client";

import { useActionState } from "react";
import { GitPullRequest, Loader2 } from "lucide-react";
import { trackPullRequestAction } from "@/server/actions/pull-request-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TrackPullRequestFormProps {
  projectId: string;
  owner: string;
  repo: string;
}

/** Starts tracking a pull request by number (fetched from GitHub). */
export function TrackPullRequestForm({ projectId, owner, repo }: TrackPullRequestFormProps) {
  const [state, formAction, pending] = useActionState(trackPullRequestAction, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const formError = state && !state.ok && !state.fieldErrors ? state.error : undefined;

  return (
    <form action={formAction} className="space-y-2" data-testid="track-pull-request-form">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="owner" value={owner} />
      <input type="hidden" name="repo" value={repo} />
      <div className="flex items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="pr-number" className="text-xs">
            Pull request number
          </Label>
          <Input
            id="pr-number"
            name="number"
            type="number"
            min={1}
            placeholder="1234"
            className="w-36"
            required
            data-testid="track-pull-request-number"
          />
        </div>
        <Button type="submit" size="sm" disabled={pending} data-testid="track-pull-request-submit">
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <GitPullRequest className="size-3.5" aria-hidden />
          )}
          Track pull request
        </Button>
      </div>
      {errors.number ? <p className="text-destructive text-xs">{errors.number}</p> : null}
      {formError ? <p className="text-destructive text-xs">{formError}</p> : null}
      <p className="text-muted-foreground text-[11px]">
        The pull request and its changed lines are read from GitHub. With the GitHub App webhook
        configured, open pull requests are tracked automatically.
      </p>
    </form>
  );
}
