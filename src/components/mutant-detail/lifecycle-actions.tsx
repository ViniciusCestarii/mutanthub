"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, RotateCcw, Undo2 } from "lucide-react";
import type { ReviewStatus } from "@/generated/prisma/enums";
import { resubmitMutantAction, withdrawMutantAction } from "@/server/actions/mutant-actions";
import type { ActionResult } from "@/server/actions/result";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { routes } from "@/lib/routes";

interface LifecycleActionsProps {
  mutantId: number;
  reviewStatus: ReviewStatus;
  canEdit: boolean;
  canResubmit: boolean;
  canWithdraw: boolean;
}

type Result = ActionResult<{ mutantId: number }>;

/**
 * Submitter controls: edit (while pending / needs information), resubmit
 * (needs information / withdrawn -> pending) and withdraw (-> withdrawn).
 */
export function LifecycleActions({
  mutantId,
  reviewStatus,
  canEdit,
  canResubmit,
  canWithdraw,
}: LifecycleActionsProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<"withdraw" | "resubmit" | null>(null);

  const wrap =
    (
      action: (prev: Result | null, formData: FormData) => Promise<Result>,
      successMessage: string,
    ) =>
    async (prev: Result | null, formData: FormData) => {
      const result = await action(prev, formData);
      if (result.ok) {
        toast.success(successMessage);
        setConfirming(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
      return result;
    };

  const [withdrawState, withdrawFormAction, withdrawPending] = useActionState(
    wrap(withdrawMutantAction, "Submission withdrawn"),
    null,
  );
  const [resubmitState, resubmitFormAction, resubmitPending] = useActionState(
    wrap(resubmitMutantAction, "Submission sent back to the review queue"),
    null,
  );

  if (!canEdit && !canResubmit && !canWithdraw) return null;

  return (
    <div className="space-y-2" data-testid="lifecycle-actions">
      <div className="flex flex-wrap gap-1.5">
        {canEdit ? (
          <Button asChild variant="outline" size="sm" data-testid="lifecycle-edit">
            <Link href={routes.mutantEdit(mutantId)}>
              <Pencil className="size-3.5" aria-hidden /> Edit submission
            </Link>
          </Button>
        ) : null}
        {canResubmit ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setConfirming(confirming === "resubmit" ? null : "resubmit")}
            data-testid="lifecycle-resubmit"
          >
            <RotateCcw className="size-3.5" aria-hidden /> Resubmit for review
          </Button>
        ) : null}
        {canWithdraw ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setConfirming(confirming === "withdraw" ? null : "withdraw")}
            data-testid="lifecycle-withdraw"
          >
            <Undo2 className="size-3.5" aria-hidden /> Withdraw
          </Button>
        ) : null}
      </div>

      {confirming === "resubmit" ? (
        <form action={resubmitFormAction} className="space-y-2" data-testid="resubmit-form">
          <input type="hidden" name="mutantId" value={mutantId} />
          <p className="text-muted-foreground text-xs">
            {reviewStatus === "NEEDS_INFORMATION"
              ? "Reviewers asked for more information. Update the submission first, then send it back to the queue."
              : "This submission was withdrawn. Resubmitting puts it back in the review queue."}
          </p>
          <Textarea
            name="comment"
            rows={2}
            placeholder="What changed? (recorded in the history)"
            className="text-xs"
            data-testid="resubmit-comment"
          />
          {resubmitState && !resubmitState.ok ? (
            <p className="text-destructive text-xs">{resubmitState.error}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={resubmitPending}
              data-testid="resubmit-submit"
            >
              {resubmitPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
              Resubmit
            </Button>
          </div>
        </form>
      ) : null}

      {confirming === "withdraw" ? (
        <form action={withdrawFormAction} className="space-y-2" data-testid="withdraw-form">
          <input type="hidden" name="mutantId" value={mutantId} />
          <p className="text-muted-foreground text-xs">
            Withdrawing removes the submission from the review queue. The record and its history
            stay visible, and you can resubmit later.
          </p>
          <Textarea
            name="reason"
            rows={2}
            placeholder="Reason (optional, recorded in the history)"
            className="text-xs"
            data-testid="withdraw-reason"
          />
          {withdrawState && !withdrawState.ok ? (
            <p className="text-destructive text-xs">{withdrawState.error}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              variant="destructive"
              disabled={withdrawPending}
              data-testid="withdraw-submit"
            >
              {withdrawPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
              Withdraw submission
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
