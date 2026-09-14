import type {
  MutationOperator,
  MutationStatus,
  ReviewStatus,
  ValidationResult,
} from "@/generated/prisma/enums";
import {
  MUTATION_STATUS_LABEL,
  REVIEW_STATUS_LABEL,
  VALIDATION_RESULT_LABEL,
} from "@/domain/mutants/status";
import { operatorLabel } from "@/domain/mutants/operators";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "muted";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "border-border bg-muted/60 text-foreground",
  info: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  danger: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  muted: "border-border bg-transparent text-muted-foreground",
};

const DOT_CLASS: Record<Tone, string> = {
  neutral: "bg-foreground/60",
  info: "bg-sky-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
  muted: "bg-muted-foreground/60",
};

export function StatusPill({
  tone,
  children,
  className,
  dot = true,
  title,
  ...rest
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
  title?: string;
} & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1.5 rounded-md border px-1.5 text-[11px] font-medium whitespace-nowrap",
        TONE_CLASS[tone],
        className,
      )}
      {...rest}
    >
      {dot ? <span className={cn("size-1.5 rounded-full", DOT_CLASS[tone])} aria-hidden /> : null}
      {children}
    </span>
  );
}

const REVIEW_TONE: Record<ReviewStatus, Tone> = {
  PENDING: "warning",
  NEEDS_INFORMATION: "info",
  APPROVED: "success",
  REJECTED: "danger",
  DUPLICATE: "muted",
  WITHDRAWN: "muted",
};

const MUTATION_TONE: Record<MutationStatus, Tone> = {
  UNKNOWN: "muted",
  SURVIVED: "warning",
  KILLED: "success",
  EQUIVALENT: "info",
  INVALID: "danger",
};

const VALIDATION_TONE: Record<ValidationResult, Tone> = {
  SURVIVED: "warning",
  KILLED: "success",
  COULD_NOT_REPRODUCE: "muted",
};

export function ReviewStatusBadge({
  status,
  className,
}: {
  status: ReviewStatus;
  className?: string;
}) {
  return (
    <StatusPill
      tone={REVIEW_TONE[status]}
      className={className}
      data-testid="review-status"
      data-status={status}
    >
      {REVIEW_STATUS_LABEL[status]}
    </StatusPill>
  );
}

export function MutationStatusBadge({
  status,
  className,
}: {
  status: MutationStatus;
  className?: string;
}) {
  return (
    <StatusPill
      tone={MUTATION_TONE[status]}
      className={className}
      data-testid="mutation-status"
      data-status={status}
    >
      {MUTATION_STATUS_LABEL[status]}
    </StatusPill>
  );
}

export function ValidationResultBadge({
  result,
  className,
}: {
  result: ValidationResult;
  className?: string;
}) {
  return (
    <StatusPill tone={VALIDATION_TONE[result]} className={className}>
      {VALIDATION_RESULT_LABEL[result]}
    </StatusPill>
  );
}

export function OperatorBadge({
  operator,
  className,
}: {
  operator: MutationOperator;
  className?: string;
}) {
  return (
    <StatusPill tone="neutral" dot={false} className={cn("font-mono text-[10px]", className)}>
      {operatorLabel(operator)}
    </StatusPill>
  );
}
