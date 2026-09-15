import type { KillClaimStatus, PullRequestState, ValidationResult } from "@/generated/prisma/enums";

export const KILL_CLAIM_STATUS_LABEL: Record<KillClaimStatus, string> = {
  CLAIMED: "Claimed",
  VERIFIED: "Verified",
  REFUTED: "Refuted",
  STALE: "Stale",
};

/** Independent reproductions needed to verify a claim without a reviewer. */
export const AUTO_VERIFY_THRESHOLD = 2;

export interface ClaimEvidence {
  /** Results of reproductions attached to the claim (at its verification commit). */
  results: ValidationResult[];
  /** State of the referenced pull request, if the claim points at one. */
  prState: PullRequestState | null;
}

/**
 * Community rule: a claim is verified when at least two reproductions killed
 * the mutant at the verification commit and none saw it survive; a single
 * survival refutes it; a closed, unmerged PR makes it stale. Reviewers can
 * always override with an explicit verdict.
 */
export function evaluateClaim(evidence: ClaimEvidence): KillClaimStatus {
  if (evidence.prState === "CLOSED") return "STALE";
  const killed = evidence.results.filter((r) => r === "KILLED").length;
  const survived = evidence.results.filter((r) => r === "SURVIVED").length;
  if (survived > 0 && killed === 0) return "REFUTED";
  if (killed >= AUTO_VERIFY_THRESHOLD && survived === 0) return "VERIFIED";
  return "CLAIMED";
}

/** Claims that still need attention (shown to reviewers). */
export function isOpenClaim(status: KillClaimStatus): boolean {
  return status === "CLAIMED";
}
