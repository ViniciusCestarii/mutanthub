import type { ValidationSummary } from "@/domain/mutants/validation-summary";
import { cn } from "@/lib/utils";

/** Compact visual of reproduction results: colored dots + count, with the label as tooltip. */
export function ValidationDots({
  summary,
  className,
}: {
  summary: ValidationSummary;
  className?: string;
}) {
  if (summary.total === 0) {
    return <span className={cn("text-muted-foreground text-xs", className)}>none</span>;
  }
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-xs", className)}
      title={summary.label}
    >
      <span className="inline-flex items-center gap-0.5">
        {Array.from({ length: Math.min(summary.survived, 5) }).map((_, i) => (
          <span key={`s${i}`} className="size-2 rounded-full bg-amber-500" />
        ))}
        {Array.from({ length: Math.min(summary.killed, 5) }).map((_, i) => (
          <span key={`k${i}`} className="size-2 rounded-full bg-emerald-500" />
        ))}
        {Array.from({ length: Math.min(summary.couldNotReproduce, 5) }).map((_, i) => (
          <span key={`c${i}`} className="bg-muted-foreground/40 size-2 rounded-full" />
        ))}
      </span>
      <span className="font-mono tabular-nums">{summary.total}</span>
      {summary.consensus === "CONFLICTING" ? (
        <span className="text-[10px] font-medium text-rose-600 dark:text-rose-400">conflict</span>
      ) : null}
    </span>
  );
}
