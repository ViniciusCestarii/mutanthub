"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, CircleHelp, Copy, Loader2, X } from "lucide-react";
import type { MutationStatus, ReviewStatus } from "@/generated/prisma/enums";
import {
  MUTATION_STATUSES,
  MUTATION_STATUS_LABEL,
  REVIEW_ACTIONS,
  REVIEW_ACTION_LABEL,
  REVIEW_ACTION_TO_STATUS,
  type ReviewAction,
} from "@/domain/mutants/status";
import { changeMutationStatusAction, reviewMutantAction } from "@/server/actions/mutant-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface ReviewActionsProps {
  mutantId: number;
  reviewStatus: ReviewStatus;
  mutationStatus: MutationStatus;
  className?: string;
}

const ACTION_ICON: Record<ReviewAction, React.ComponentType<{ className?: string }>> = {
  APPROVE: Check,
  REJECT: X,
  NEEDS_INFORMATION: CircleHelp,
  MARK_DUPLICATE: Copy,
};

const ACTION_CLASS: Record<ReviewAction, string> = {
  APPROVE: "text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300",
  REJECT: "text-rose-700 hover:bg-rose-500/10 dark:text-rose-300",
  NEEDS_INFORMATION: "text-sky-700 hover:bg-sky-500/10 dark:text-sky-300",
  MARK_DUPLICATE: "text-muted-foreground hover:bg-muted",
};

/**
 * Moderation controls for reviewers: review actions (approve/reject/needs
 * information/mark duplicate) and classification of the scientific outcome.
 * Shared by the mutant detail page and the review queue panel.
 */
export function ReviewActions({
  mutantId,
  reviewStatus,
  mutationStatus,
  className,
}: ReviewActionsProps) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<ReviewAction | null>(null);
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [targetStatus, setTargetStatus] = useState<MutationStatus | "">("");

  // Side effects (toasts, refresh, resetting local UI) run inside the action
  // transition itself, after the server responds.
  const [reviewState, reviewFormAction, reviewPending] = useActionState(
    async (prev: Awaited<ReturnType<typeof reviewMutantAction>> | null, formData: FormData) => {
      const result = await reviewMutantAction(prev, formData);
      if (result.ok) {
        toast.success(
          `Mutant #${result.data.mutantId} marked as ${result.data.reviewStatus.toLowerCase().replace("_", " ")}`,
        );
        setShowDuplicate(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
      setPendingAction(null);
      return result;
    },
    null,
  );
  const [classifyState, classifyFormAction, classifyPending] = useActionState(
    async (
      prev: Awaited<ReturnType<typeof changeMutationStatusAction>> | null,
      formData: FormData,
    ) => {
      const result = await changeMutationStatusAction(prev, formData);
      if (result.ok) {
        toast.success(
          `Mutant #${result.data.mutantId} classified as ${result.data.mutationStatus.toLowerCase()}`,
        );
        setTargetStatus("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
      return result;
    },
    null,
  );

  const reviewErrors = reviewState && !reviewState.ok ? (reviewState.fieldErrors ?? {}) : {};
  const classifyErrors =
    classifyState && !classifyState.ok ? (classifyState.fieldErrors ?? {}) : {};

  return (
    <div className={cn("space-y-4", className)} data-testid="review-actions">
      <form action={reviewFormAction} className="space-y-2">
        <input type="hidden" name="mutantId" value={mutantId} />
        {reviewStatus === "WITHDRAWN" ? (
          <p className="text-muted-foreground text-xs">
            The submitter withdrew this mutant. It can only re-enter the queue if they resubmit it.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-1.5">
          {REVIEW_ACTIONS.map((action) => {
            const Icon = ACTION_ICON[action];
            const isCurrent = REVIEW_ACTION_TO_STATUS[action] === reviewStatus;
            const isDuplicateToggle = action === "MARK_DUPLICATE";
            return (
              <Button
                key={action}
                type={isDuplicateToggle && !showDuplicate ? "button" : "submit"}
                name="action"
                value={action}
                variant="outline"
                size="sm"
                disabled={isCurrent || reviewPending || reviewStatus === "WITHDRAWN"}
                className={cn(
                  ACTION_CLASS[action],
                  isDuplicateToggle && showDuplicate && "border-primary",
                )}
                data-testid={`review-action-${action}`}
                onClick={(e) => {
                  if (isDuplicateToggle && !showDuplicate) {
                    e.preventDefault();
                    setShowDuplicate(true);
                    return;
                  }
                  setPendingAction(action);
                }}
                title={
                  isCurrent ? `Already ${reviewStatus.toLowerCase().replace("_", " ")}` : undefined
                }
              >
                {reviewPending && pendingAction === action ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Icon className="size-3.5" aria-hidden />
                )}
                {REVIEW_ACTION_LABEL[action]}
              </Button>
            );
          })}
        </div>
        {showDuplicate ? (
          <div className="space-y-1">
            <Label htmlFor={`dup-${mutantId}`} className="text-xs">
              Original mutant id
            </Label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-mono text-xs">#</span>
              <Input
                id={`dup-${mutantId}`}
                name="duplicateOfId"
                type="number"
                min={1}
                className="h-7 w-32 font-mono text-xs"
                placeholder="182"
                data-testid="review-duplicate-of"
              />
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setShowDuplicate(false)}
              >
                Cancel
              </Button>
            </div>
            {reviewErrors.duplicateOfId ? (
              <p className="text-destructive text-xs">{reviewErrors.duplicateOfId}</p>
            ) : null}
          </div>
        ) : null}
        <Textarea
          name="comment"
          placeholder="Optional note for the submitter (recorded in the history)"
          rows={2}
          className="text-xs"
          data-testid="review-comment"
        />
        {reviewErrors.comment ? (
          <p className="text-destructive text-xs">{reviewErrors.comment}</p>
        ) : null}
        {reviewState && !reviewState.ok && !reviewState.fieldErrors ? (
          <p className="text-destructive text-xs">{reviewState.error}</p>
        ) : null}
      </form>

      <form action={classifyFormAction} className="border-border space-y-2 border-t pt-3">
        <input type="hidden" name="mutantId" value={mutantId} />
        <input type="hidden" name="status" value={targetStatus} />
        <div className="text-xs font-medium">Classify outcome</div>
        <p className="text-muted-foreground text-xs">
          Currently <span className="font-mono">{MUTATION_STATUS_LABEL[mutationStatus]}</span>.
          Changing the outcome appends to the mutant history; nothing is overwritten.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={targetStatus} onValueChange={(v) => setTargetStatus(v as MutationStatus)}>
            <SelectTrigger
              size="sm"
              className="w-44"
              data-testid="classify-status"
              aria-label="New mutation status"
            >
              <SelectValue placeholder="New status" />
            </SelectTrigger>
            <SelectContent>
              {MUTATION_STATUSES.filter((s) => s !== mutationStatus).map((s) => (
                <SelectItem key={s} value={s} data-testid={`classify-option-${s}`}>
                  {MUTATION_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            disabled={!targetStatus || classifyPending}
            data-testid="classify-submit"
          >
            {classifyPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
            Apply
          </Button>
        </div>
        <Textarea
          name="comment"
          placeholder="Why? (e.g. link to the test that kills it, or the equivalence argument)"
          rows={2}
          className="text-xs"
          data-testid="classify-comment"
        />
        {classifyErrors.status ? (
          <p className="text-destructive text-xs">{classifyErrors.status}</p>
        ) : null}
        {classifyState && !classifyState.ok && !classifyState.fieldErrors ? (
          <p className="text-destructive text-xs">{classifyState.error}</p>
        ) : null}
      </form>
    </div>
  );
}
