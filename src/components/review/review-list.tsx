import Link from "next/link";
import { Copy, Inbox } from "lucide-react";
import type { ReviewQueueItem } from "@/server/services/review-service";
import { summarizeValidations } from "@/domain/mutants/validation-summary";
import { EmptyState } from "@/components/shared/empty-state";
import { UserChip } from "@/components/shared/user-chip";
import { ReviewStatusBadge, StatusPill } from "@/components/mutants/status-badge";
import { ValidationDots } from "@/components/mutants/validation-dots";
import { operatorLabel } from "@/domain/mutants/operators";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ReviewListProps {
  items: ReviewQueueItem[];
  selectedId: number | null;
  /** Builds the href that selects an item while preserving filters. */
  hrefFor: (id: number) => string;
}

/** Inbox-style list of submissions awaiting moderation. */
export function ReviewList({ items, selectedId, hrefFor }: ReviewListProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="Nothing to review"
        description="No submissions match the current filters. Adjust them or check back later."
      />
    );
  }
  return (
    <ol
      className="divide-border border-border bg-card divide-y rounded-lg border"
      data-testid="review-queue"
    >
      {items.map((m) => {
        const summary = summarizeValidations(m.validations.map((v) => v.result));
        const selected = m.id === selectedId;
        return (
          <li key={m.id} data-testid="review-item" data-mutant-id={m.id} data-selected={selected}>
            <Link
              href={hrefFor(m.id)}
              scroll={false}
              aria-current={selected ? "true" : undefined}
              className={cn(
                "hover:bg-muted/50 block px-3 py-2.5 transition-colors",
                selected && "bg-muted/70 shadow-[inset_2px_0_0_0_var(--color-primary)]",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div
                    className="text-muted-foreground truncate font-mono text-[11px]"
                    title={m.filePath}
                  >
                    {m.project.githubOwner}/{m.project.githubRepository} · {m.filePath}
                    <span className="text-foreground">:{m.startLine}</span>
                  </div>
                  <div className="mt-0.5 truncate text-sm font-medium">{m.title}</div>
                </div>
                <span className="text-muted-foreground shrink-0 font-mono text-[11px]">
                  #{m.id}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <UserChip user={m.createdBy} size="xs" asLink={false} />
                <ReviewStatusBadge status={m.reviewStatus} />
                {m.possibleDuplicate ? (
                  <StatusPill tone="warning" dot={false} data-testid="possible-duplicate-pill">
                    <Copy className="size-3" aria-hidden /> Possible duplicate
                  </StatusPill>
                ) : null}
                <span className="text-muted-foreground">{operatorLabel(m.mutationOperator)}</span>
                <ValidationDots summary={summary} />
                <time
                  className="text-muted-foreground ml-auto"
                  dateTime={m.createdAt.toISOString()}
                >
                  {relativeTime(m.createdAt)}
                </time>
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
