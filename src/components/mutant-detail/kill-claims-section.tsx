import Link from "next/link";
import { ExternalLink, Target } from "lucide-react";
import type { KillClaimItem } from "@/server/repositories/kill-claim-repository";
import { KILL_CLAIM_STATUS_LABEL } from "@/domain/kill-claims/status";
import { referenceLabel } from "@/domain/kill-claims/reference";
import { routes } from "@/lib/routes";
import { absoluteDate, shortSha } from "@/lib/format";
import { Section } from "@/components/shared/section";
import { EmptyState } from "@/components/shared/empty-state";
import { UserChip } from "@/components/shared/user-chip";
import { StatusPill } from "@/components/mutants/status-badge";
import { KillClaimForm } from "./kill-claim-form";
import { KillClaimControls } from "./kill-claim-controls";

interface KillClaimsSectionProps {
  mutantId: number;
  project: { owner: string; repo: string };
  claims: KillClaimItem[];
  signedIn: boolean;
  canReview: boolean;
}

const STATUS_TONE = {
  CLAIMED: "info",
  VERIFIED: "success",
  REFUTED: "danger",
  STALE: "muted",
} as const;

const APPLIES_TEXT = {
  UNKNOWN: null,
  APPLIES: "Original code still present at the same line",
  MOVED: "Original code moved",
  NOT_FOUND: "Original code no longer present: the mutant cannot be reproduced there",
} as const;

/** Structured "this PR / commit / test kills the mutant" claims and their verification. */
export function KillClaimsSection({
  mutantId,
  project,
  claims,
  signedIn,
  canReview,
}: KillClaimsSectionProps) {
  return (
    <Section
      title="Killing tests"
      description="Claims that a change kills this mutant, checked against GitHub and verified by reproductions"
      id="killing-tests"
    >
      {claims.length === 0 ? (
        <EmptyState icon={Target} title="No killing test reported yet" compact />
      ) : (
        <ul className="divide-border divide-y" data-testid="kill-claim-list">
          {claims.map((claim) => {
            const label = referenceLabel(claim.kind, claim.reference);
            const href =
              claim.kind === "PULL_REQUEST"
                ? routes.github.pull(project.owner, project.repo, Number(claim.reference))
                : claim.kind === "COMMIT"
                  ? routes.github.commit(project.owner, project.repo, claim.reference)
                  : null;
            const killed = claim.validations.filter((v) => v.result === "KILLED").length;
            const survived = claim.validations.filter((v) => v.result === "SURVIVED").length;
            return (
              <li
                key={claim.id}
                className="space-y-1.5 py-3 text-sm"
                data-testid="kill-claim"
                data-status={claim.status}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone={STATUS_TONE[claim.status]} data-testid="kill-claim-status">
                    {KILL_CLAIM_STATUS_LABEL[claim.status]}
                  </StatusPill>
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs hover:underline"
                    >
                      {label} <ExternalLink className="inline size-3 align-text-top" aria-hidden />
                    </a>
                  ) : (
                    <span className="font-mono text-xs">{label}</span>
                  )}
                  {claim.pullRequest ? (
                    <Link
                      href={routes.projectPull(
                        project.owner,
                        project.repo,
                        claim.pullRequest.number,
                      )}
                      className="text-muted-foreground text-xs hover:underline"
                    >
                      tracked · {claim.pullRequest.state.toLowerCase()}
                    </Link>
                  ) : null}
                  {claim.prTouchesTests === true ? (
                    <span className="text-muted-foreground text-[11px]">touches tests</span>
                  ) : claim.prTouchesTests === false ? (
                    <span className="text-[11px] text-amber-700 dark:text-amber-300">
                      no test files changed
                    </span>
                  ) : null}
                </div>
                {claim.note ? <p className="text-muted-foreground text-xs">{claim.note}</p> : null}
                <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                  <span>
                    by <UserChip user={claim.claimedBy} size="xs" /> ·{" "}
                    {absoluteDate(claim.createdAt)}
                  </span>
                  {claim.verifyCommitSha ? (
                    <span>
                      verify at{" "}
                      <a
                        href={routes.github.commit(
                          project.owner,
                          project.repo,
                          claim.verifyCommitSha,
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono hover:underline"
                      >
                        {shortSha(claim.verifyCommitSha)}
                      </a>
                    </span>
                  ) : null}
                  {APPLIES_TEXT[claim.applies] ? (
                    <span data-testid="kill-claim-applies" data-applies={claim.applies}>
                      {APPLIES_TEXT[claim.applies]}
                      {claim.applies === "MOVED" && claim.appliesLine
                        ? ` to line ${claim.appliesLine}`
                        : ""}
                    </span>
                  ) : null}
                  <span>
                    reproductions at that commit: {killed} killed, {survived} survived
                  </span>
                </div>
                {claim.resolvedBy ? (
                  <p className="text-xs">
                    {claim.status === "VERIFIED" ? "Verified" : "Refuted"} by{" "}
                    <UserChip user={claim.resolvedBy} size="xs" />
                    {claim.resolutionNote ? `: ${claim.resolutionNote}` : ""}
                  </p>
                ) : null}
                {signedIn ? (
                  <KillClaimControls
                    claimId={claim.id}
                    status={claim.status}
                    canReview={canReview}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <div className="border-border mt-3 border-t pt-3">
        {signedIn ? (
          <KillClaimForm mutantId={mutantId} />
        ) : (
          <p className="text-muted-foreground text-xs">
            <Link href={routes.signIn(routes.mutant(mutantId))} className="underline">
              Sign in
            </Link>{" "}
            to report a pull request, commit or test that kills this mutant.
          </p>
        )}
      </div>
    </Section>
  );
}
