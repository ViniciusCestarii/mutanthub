import { ChevronDown, ShieldCheck } from "lucide-react";
import type { MutantDetail } from "@/server/repositories/mutant-repository";
import { Section } from "@/components/shared/section";
import { CodeBlock } from "@/components/code/code-block";
import { Markdown } from "@/components/shared/markdown";
import { UserChip } from "@/components/shared/user-chip";
import { StatusPill } from "@/components/mutants/status-badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { absoluteDate, formatDuration } from "@/lib/format";

type Submission = MutantDetail["submissions"][number];

const OBSERVED_TONE = {
  SURVIVED: "warning",
  KILLED: "success",
  UNKNOWN: "muted",
} as const;

interface EvidenceSectionProps {
  submissions: Submission[];
  compact?: boolean;
}

/** How the submitter tested the mutant. Everything here is text evidence only. */
export function EvidenceSection({ submissions, compact }: EvidenceSectionProps) {
  return (
    <Section
      title="Test evidence"
      description="Commands and environment reported by the submitter"
      className={compact ? "border-0 bg-transparent [&>div]:p-0 [&>header]:px-0" : undefined}
    >
      <div className="space-y-5" data-testid="test-evidence">
        {submissions.length > 1 ? (
          <p className="text-muted-foreground text-xs">
            This submission was edited {submissions.length - 1} time
            {submissions.length === 2 ? "" : "s"}. The latest evidence is shown first; earlier
            versions are kept for the record.
          </p>
        ) : null}
        {[...submissions].reverse().map((s, index) => (
          <div
            key={s.id}
            className={index > 0 ? "border-border border-t pt-4 opacity-80" : undefined}
          >
            {submissions.length > 1 ? (
              <p className="text-muted-foreground mb-2 text-[11px] tracking-wide uppercase">
                {index === 0 ? "Current evidence" : `Revision ${submissions.length - index}`}
              </p>
            ) : null}
            <SubmissionEvidence submission={s} compact={compact} />
          </div>
        ))}
        <p className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
          <ShieldCheck className="size-3.5" aria-hidden />
          Commands are shown as text and never executed by MutantHub.
        </p>
      </div>
    </Section>
  );
}

function SubmissionEvidence({
  submission: s,
  compact,
}: {
  submission: Submission;
  compact?: boolean;
}) {
  const duration = formatDuration(s.testDurationSeconds);
  return (
    <div className="space-y-3">
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <UserChip user={s.submittedBy} size="xs" />
        <span>{absoluteDate(s.createdAt)}</span>
        <span className="inline-flex items-center gap-1">
          Observed:
          <StatusPill tone={OBSERVED_TONE[s.observedResult]}>
            {s.observedResult.toLowerCase()}
          </StatusPill>
        </span>
        {duration ? <span>Duration: {duration}</span> : null}
      </div>
      <div className="space-y-2">
        {s.buildCommand ? <CodeBlock label="Build command" code={s.buildCommand} /> : null}
        <CodeBlock label="Test command" code={s.testCommand} />
        {s.fuzzCommand ? <CodeBlock label="Fuzz command" code={s.fuzzCommand} /> : null}
      </div>
      <dl className={`grid gap-x-6 gap-y-1 text-xs ${compact ? "grid-cols-1" : "sm:grid-cols-3"}`}>
        <div>
          <dt className="text-muted-foreground">Environment</dt>
          <dd className="whitespace-pre-wrap">{s.environmentDescription}</dd>
        </div>
        {s.operatingSystem ? (
          <div>
            <dt className="text-muted-foreground">Operating system</dt>
            <dd>{s.operatingSystem}</dd>
          </div>
        ) : null}
        {s.compiler ? (
          <div>
            <dt className="text-muted-foreground">Compiler</dt>
            <dd>{s.compiler}</dd>
          </div>
        ) : null}
      </dl>
      {s.notes ? (
        <div>
          <div className="text-muted-foreground mb-1 text-xs">Notes</div>
          <Markdown source={s.notes} className="text-xs" />
        </div>
      ) : null}
      {s.stdout ? <LogBlock label="stdout" content={s.stdout} /> : null}
      {s.stderr ? <LogBlock label="stderr" content={s.stderr} /> : null}
    </div>
  );
}

function LogBlock({ label, content }: { label: string; content: string }) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="group text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs">
        <ChevronDown
          className="size-3.5 transition-transform group-data-[state=open]:rotate-180"
          aria-hidden
        />
        Show {label} ({content.length.toLocaleString()} chars)
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1">
        <CodeBlock label={label} code={content} className="max-h-72 overflow-auto" />
      </CollapsibleContent>
    </Collapsible>
  );
}
