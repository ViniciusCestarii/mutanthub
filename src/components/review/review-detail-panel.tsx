import Link from "next/link";
import { ExternalLink, Inbox } from "lucide-react";
import type { MutantDetailView } from "@/server/services/mutant-service";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { MutantHeader } from "@/components/mutant-detail/mutant-header";
import { MutantNotices } from "@/components/mutant-detail/mutant-notices";
import { DiffSection } from "@/components/mutant-detail/diff-section";
import { EvidenceSection } from "@/components/mutant-detail/evidence-section";
import { ReproductionSection } from "@/components/mutant-detail/reproduction-section";
import { HistorySection } from "@/components/mutant-detail/history-section";
import { DiscussionSection } from "@/components/mutant-detail/discussion-section";
import { ReviewActions } from "./review-actions";
import { routes } from "@/lib/routes";

interface ReviewDetailPanelProps {
  view: MutantDetailView | null;
  signedIn: boolean;
}

/** Right-hand panel of the review inbox: everything needed to decide, without leaving the queue. */
export function ReviewDetailPanel({ view, signedIn }: ReviewDetailPanelProps) {
  if (!view) {
    return (
      <div className="border-border bg-card rounded-lg border" data-testid="review-detail">
        <EmptyState
          icon={Inbox}
          title="Select a submission to review"
          description="The source diff, test evidence, reproductions and history will appear here."
          className="border-0"
        />
      </div>
    );
  }
  const { mutant } = view;
  return (
    <div
      className="border-border bg-card space-y-5 rounded-lg border p-4"
      data-testid="review-detail"
      data-mutant-id={mutant.id}
    >
      <MutantHeader
        mutant={mutant}
        compact
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={routes.mutant(mutant.id)} data-testid="review-open-full">
              Open full page <ExternalLink className="size-3.5" aria-hidden />
            </Link>
          </Button>
        }
      />
      {view.canReview ? (
        <div className="border-border bg-muted/30 rounded-md border p-3">
          <ReviewActions
            mutantId={mutant.id}
            reviewStatus={mutant.reviewStatus}
            mutationStatus={mutant.mutationStatus}
          />
        </div>
      ) : null}
      <MutantNotices view={view} />
      <DiffSection
        mutantId={mutant.id}
        filePath={mutant.filePath}
        originalCode={mutant.originalCode}
        mutatedCode={mutant.mutatedCode}
        gitDiff={mutant.gitDiff}
        height={200}
        compact
      />
      {mutant.submissions.at(-1)?.environmentDescription ? null : (
        <p
          className="border-border text-muted-foreground rounded-md border border-dashed px-3 py-2 text-xs"
          data-testid="review-environment-hint"
        >
          No environment was given. If it matters for reproducing the result, ask the submitter with
          &ldquo;Needs information&rdquo;.
        </p>
      )}
      <EvidenceSection submissions={mutant.submissions} compact />
      <ReproductionSection
        mutantId={mutant.id}
        summary={view.validationSummary}
        validations={mutant.validations}
        signedIn={signedIn}
        readOnly
        compact
      />
      <HistorySection history={mutant.statusHistory} compact />
      <DiscussionSection
        mutantId={mutant.id}
        comments={mutant.comments}
        signedIn={signedIn}
        readOnly
        compact
      />
    </div>
  );
}
