import { ArrowRight } from "lucide-react";
import type { MutantDetail } from "@/server/repositories/mutant-repository";
import { Section } from "@/components/shared/section";
import { UserChip } from "@/components/shared/user-chip";
import { absoluteDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

interface HistorySectionProps {
  history: MutantDetail["statusHistory"];
  compact?: boolean;
}

/** Append-only timeline of review and mutation status transitions. */
export function HistorySection({ history, compact }: HistorySectionProps) {
  return (
    <Section
      title="History"
      description="Every status transition is preserved"
      className={compact ? "border-0 bg-transparent [&>div]:p-0 [&>header]:px-0" : undefined}
    >
      <ol className="border-border space-y-2.5 border-l pl-3" data-testid="status-history">
        {history.map((h) => (
          <li key={h.id} className="relative text-xs" data-testid="history-item" data-kind={h.kind}>
            <span
              className={cn(
                "border-background absolute top-1.5 -left-[17px] size-2 rounded-full border",
                h.kind === "REVIEW"
                  ? "bg-sky-500"
                  : h.kind === "MUTATION"
                    ? "bg-amber-500"
                    : "bg-muted-foreground/60",
              )}
              aria-hidden
            />
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="border-border text-muted-foreground rounded border px-1 text-[10px] tracking-wide uppercase">
                {h.kind === "REVIEW" ? "Review" : h.kind === "MUTATION" ? "Mutation" : "Submission"}
              </span>
              {h.kind === "SUBMISSION" ? (
                <span className="font-medium">Submission edited</span>
              ) : (
                <span className="inline-flex items-center gap-1 font-mono">
                  <span className="text-muted-foreground">{h.previousValue ?? "—"}</span>
                  <ArrowRight className="text-muted-foreground size-3" aria-hidden />
                  <span className="font-medium">{h.newValue}</span>
                </span>
              )}
            </div>
            <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2">
              {h.changedBy ? <UserChip user={h.changedBy} size="xs" /> : <span>System</span>}
              <time dateTime={h.createdAt.toISOString()}>{absoluteDateTime(h.createdAt)}</time>
            </div>
            {h.comment ? (
              <p className="text-foreground/90 mt-0.5 whitespace-pre-wrap">{h.comment}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </Section>
  );
}
