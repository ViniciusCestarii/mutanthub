"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, RefreshCw, X } from "lucide-react";
import type { KillClaimStatus } from "@/generated/prisma/enums";
import {
  refreshKillClaimAction,
  resolveKillClaimAction,
} from "@/server/actions/kill-claim-actions";
import type { ActionResult } from "@/server/actions/result";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Result = ActionResult<{ claimId: string; status: string }>;

interface KillClaimControlsProps {
  claimId: string;
  status: KillClaimStatus;
  canReview: boolean;
}

/** Refresh (anyone signed in) and reviewer verdicts for a claim. */
export function KillClaimControls({ claimId, status, canReview }: KillClaimControlsProps) {
  const router = useRouter();
  const [showNote, setShowNote] = useState(false);
  const wrap =
    (
      action: (prev: Result | null, formData: FormData) => Promise<Result>,
      message: (r: Result) => string,
    ) =>
    async (prev: Result | null, formData: FormData) => {
      const result = await action(prev, formData);
      if (result.ok) {
        toast.success(message(result));
        setShowNote(false);
        router.refresh();
      } else toast.error(result.error);
      return result;
    };
  const [, refreshAction, refreshing] = useActionState(
    wrap(refreshKillClaimAction, (r) =>
      r.ok ? `Claim re-checked: ${r.data.status.toLowerCase()}` : "",
    ),
    null,
  );
  const [, resolveAction, resolving] = useActionState(
    wrap(resolveKillClaimAction, (r) => (r.ok ? `Claim ${r.data.status.toLowerCase()}` : "")),
    null,
  );
  const open = status === "CLAIMED" || status === "STALE";

  return (
    <div className="flex flex-wrap items-start gap-1.5" data-testid="kill-claim-controls">
      <form action={refreshAction}>
        <input type="hidden" name="claimId" value={claimId} />
        <Button
          type="submit"
          variant="ghost"
          size="xs"
          disabled={refreshing}
          data-testid="kill-claim-refresh"
        >
          {refreshing ? (
            <Loader2 className="size-3 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="size-3" aria-hidden />
          )}
          Re-check
        </Button>
      </form>
      {canReview && open ? (
        <form action={resolveAction} className="flex flex-wrap items-start gap-1.5">
          <input type="hidden" name="claimId" value={claimId} />
          {showNote ? (
            <Textarea
              name="note"
              rows={1}
              placeholder="Verdict note (optional)"
              className="w-64 text-xs"
              data-testid="kill-claim-note-input"
            />
          ) : null}
          <Button
            type={showNote ? "submit" : "button"}
            name="verdict"
            value="VERIFIED"
            variant="outline"
            size="xs"
            className="text-emerald-700 dark:text-emerald-300"
            disabled={resolving}
            onClick={(e) => {
              if (!showNote) {
                e.preventDefault();
                setShowNote(true);
              }
            }}
            data-testid="kill-claim-verify"
          >
            <Check className="size-3" aria-hidden /> Verify
          </Button>
          {showNote ? (
            <Button
              type="submit"
              name="verdict"
              value="REFUTED"
              variant="outline"
              size="xs"
              className="text-rose-700 dark:text-rose-300"
              disabled={resolving}
              data-testid="kill-claim-refute"
            >
              <X className="size-3" aria-hidden /> Refute
            </Button>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
