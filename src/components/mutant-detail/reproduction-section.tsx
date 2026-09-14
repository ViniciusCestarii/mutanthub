import { ChevronDown, FlaskConical } from "lucide-react";
import type { MutantDetail } from "@/server/repositories/mutant-repository";
import type { ValidationSummary } from "@/domain/mutants/validation-summary";
import { Section } from "@/components/shared/section";
import { UserChip } from "@/components/shared/user-chip";
import { ValidationResultBadge } from "@/components/mutants/status-badge";
import { CodeBlock } from "@/components/code/code-block";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { absoluteDate, absoluteDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ValidationForm } from "./validation-form";

interface ReproductionSectionProps {
  mutantId: number;
  summary: ValidationSummary;
  validations: MutantDetail["validations"];
  signedIn: boolean;
  readOnly?: boolean;
  compact?: boolean;
}

const CONSENSUS_CLASS: Record<ValidationSummary["consensus"], string> = {
  NONE: "text-muted-foreground",
  SURVIVED: "text-amber-700 dark:text-amber-300",
  KILLED: "text-emerald-700 dark:text-emerald-300",
  COULD_NOT_REPRODUCE: "text-muted-foreground",
  CONFLICTING: "text-rose-700 dark:text-rose-300",
};

/** Reproduction summary, the "record a reproduction" form and the validation timeline. */
export function ReproductionSection({
  mutantId,
  summary,
  validations,
  signedIn,
  readOnly,
  compact,
}: ReproductionSectionProps) {
  return (
    <Section
      title="Reproduction status"
      className={compact ? "border-0 bg-transparent [&>div]:p-0 [&>header]:px-0" : undefined}
    >
      <div className="space-y-4">
        <div>
          <p
            className={cn("text-sm font-semibold", CONSENSUS_CLASS[summary.consensus])}
            data-testid="validation-summary"
          >
            {summary.label}
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            <CountRow color="bg-amber-500" label="survived" count={summary.survived} />
            <CountRow color="bg-emerald-500" label="killed" count={summary.killed} />
            <CountRow
              color="bg-muted-foreground/40"
              label="could not reproduce"
              count={summary.couldNotReproduce}
            />
          </ul>
        </div>

        {readOnly ? null : <ValidationForm mutantId={mutantId} signedIn={signedIn} />}

        <div>
          <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
            Validation history
          </h3>
          {validations.length === 0 ? (
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <FlaskConical className="size-3.5" aria-hidden /> No reproduction attempts recorded
              yet.
            </p>
          ) : (
            <ol className="border-border space-y-2 border-l pl-3" data-testid="validation-history">
              {validations.map((v) => (
                <li key={v.id} className="relative text-xs" data-testid="validation-item">
                  <span
                    className="border-background bg-border absolute top-1.5 -left-[17px] size-2 rounded-full border"
                    aria-hidden
                  />
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <UserChip user={v.user} size="xs" />
                    <ValidationResultBadge result={v.result} />
                    <time
                      dateTime={v.createdAt.toISOString()}
                      title={absoluteDateTime(v.createdAt)}
                      className="text-muted-foreground"
                    >
                      {absoluteDate(v.createdAt)}
                    </time>
                  </div>
                  {v.killingTestRef ? (
                    <p className="mt-1 text-[11px]" data-testid="validation-killing-test-ref">
                      <span className="text-muted-foreground">Killing test:</span>{" "}
                      {/^https?:\/\//.test(v.killingTestRef) ? (
                        <a
                          href={v.killingTestRef}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="font-mono break-all underline underline-offset-2"
                        >
                          {v.killingTestRef}
                        </a>
                      ) : (
                        <span className="font-mono break-all">{v.killingTestRef}</span>
                      )}
                    </p>
                  ) : null}
                  {v.notes || v.command || v.environment ? (
                    <Collapsible className="mt-1">
                      <CollapsibleTrigger className="group text-muted-foreground hover:text-foreground flex items-center gap-1 text-[11px]">
                        <ChevronDown
                          className="size-3 transition-transform group-data-[state=open]:rotate-180"
                          aria-hidden
                        />
                        Details
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-1 space-y-1.5">
                        {v.notes ? <p className="whitespace-pre-wrap">{v.notes}</p> : null}
                        {v.command ? (
                          <CodeBlock label="Command" code={v.command} copyable={false} />
                        ) : null}
                        {v.environment ? (
                          <p className="text-muted-foreground">
                            <span className="text-foreground font-medium">Environment:</span>{" "}
                            {v.environment}
                          </p>
                        ) : null}
                      </CollapsibleContent>
                    </Collapsible>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </Section>
  );
}

function CountRow({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <li className="flex items-center gap-2">
      <span className={cn("size-2 rounded-full", color)} aria-hidden />
      <span className="w-6 font-mono tabular-nums">{count}</span>
      <span className="text-muted-foreground">{label}</span>
    </li>
  );
}
