import { MessageSquare } from "lucide-react";
import type { MutantDetail } from "@/server/repositories/mutant-repository";
import { Section } from "@/components/shared/section";
import { Markdown } from "@/components/shared/markdown";
import { UserChip } from "@/components/shared/user-chip";
import { EmptyState } from "@/components/shared/empty-state";
import { absoluteDateTime, relativeTime } from "@/lib/format";
import { CommentForm } from "./comment-form";

interface DiscussionSectionProps {
  mutantId: number;
  comments: MutantDetail["comments"];
  signedIn: boolean;
  /** Read-only variant (review panel) with no form. */
  readOnly?: boolean;
  compact?: boolean;
}

export function DiscussionSection({
  mutantId,
  comments,
  signedIn,
  readOnly,
  compact,
}: DiscussionSectionProps) {
  return (
    <Section
      title="Discussion"
      description={`${comments.length} comment${comments.length === 1 ? "" : "s"}`}
      id="discussion"
      className={compact ? "border-0 bg-transparent [&>div]:p-0 [&>header]:px-0" : undefined}
    >
      <div className="space-y-4">
        {comments.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No comments yet"
            description="Discuss equivalence, reproduction difficulties, or a test that kills this mutant."
            compact
          />
        ) : (
          <ol className="space-y-3" data-testid="comment-list">
            {comments.map((c) => (
              <li key={c.id} className="border-border rounded-md border" data-testid="comment-item">
                <div className="border-border bg-muted/30 flex flex-wrap items-center gap-2 border-b px-3 py-1.5 text-xs">
                  <UserChip user={c.user} size="xs" />
                  <time
                    dateTime={c.createdAt.toISOString()}
                    title={absoluteDateTime(c.createdAt)}
                    className="text-muted-foreground"
                  >
                    {relativeTime(c.createdAt)}
                  </time>
                  {c.updatedAt.getTime() - c.createdAt.getTime() > 60_000 ? (
                    <span className="text-muted-foreground">(edited)</span>
                  ) : null}
                </div>
                <div className="px-3 py-2">
                  <Markdown source={c.body} />
                </div>
              </li>
            ))}
          </ol>
        )}
        {readOnly ? null : <CommentForm mutantId={mutantId} signedIn={signedIn} />}
      </div>
    </Section>
  );
}
