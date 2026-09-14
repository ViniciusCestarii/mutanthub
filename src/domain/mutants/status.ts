import type {
  ActivityType,
  MutationStatus,
  ReviewStatus,
  ValidationResult,
} from "@/generated/prisma/enums";

export const REVIEW_STATUSES: ReviewStatus[] = [
  "PENDING",
  "NEEDS_INFORMATION",
  "APPROVED",
  "REJECTED",
  "DUPLICATE",
  "WITHDRAWN",
];

/** Review states in which the submitter may still edit, resubmit or withdraw. */
export const EDITABLE_REVIEW_STATUSES: ReviewStatus[] = ["PENDING", "NEEDS_INFORMATION"];
export const RESUBMITTABLE_REVIEW_STATUSES: ReviewStatus[] = ["NEEDS_INFORMATION", "WITHDRAWN"];
export const WITHDRAWABLE_REVIEW_STATUSES: ReviewStatus[] = ["PENDING", "NEEDS_INFORMATION"];

export const MUTATION_STATUSES: MutationStatus[] = [
  "UNKNOWN",
  "SURVIVED",
  "KILLED",
  "EQUIVALENT",
  "INVALID",
];

export const VALIDATION_RESULTS: ValidationResult[] = ["SURVIVED", "KILLED", "COULD_NOT_REPRODUCE"];

export type ReviewAction = "APPROVE" | "REJECT" | "NEEDS_INFORMATION" | "MARK_DUPLICATE";

export const REVIEW_ACTIONS: ReviewAction[] = [
  "APPROVE",
  "REJECT",
  "NEEDS_INFORMATION",
  "MARK_DUPLICATE",
];

export const REVIEW_ACTION_TO_STATUS: Record<ReviewAction, ReviewStatus> = {
  APPROVE: "APPROVED",
  REJECT: "REJECTED",
  NEEDS_INFORMATION: "NEEDS_INFORMATION",
  MARK_DUPLICATE: "DUPLICATE",
};

export const REVIEW_STATUS_ACTIVITY: Record<ReviewStatus, ActivityType | null> = {
  PENDING: null,
  APPROVED: "MUTANT_APPROVED",
  REJECTED: "MUTANT_REJECTED",
  NEEDS_INFORMATION: "MUTANT_NEEDS_INFORMATION",
  DUPLICATE: "MUTANT_MARKED_DUPLICATE",
  WITHDRAWN: "MUTANT_WITHDRAWN",
};

export const MUTATION_STATUS_ACTIVITY: Record<MutationStatus, ActivityType> = {
  UNKNOWN: "MUTANT_STATUS_CHANGED",
  SURVIVED: "MUTANT_STATUS_CHANGED",
  KILLED: "MUTANT_KILLED",
  EQUIVALENT: "MUTANT_MARKED_EQUIVALENT",
  INVALID: "MUTANT_MARKED_INVALID",
};

/**
 * Reviewer transitions. Reviewers may move between moderation states except
 * back to PENDING (only the submitter re-opens, via resubmission), never into
 * WITHDRAWN (only the submitter withdraws), and never out of WITHDRAWN.
 */
export function canTransitionReview(from: ReviewStatus, to: ReviewStatus): boolean {
  if (from === to) return false;
  if (to === "PENDING" || to === "WITHDRAWN") return false;
  if (from === "WITHDRAWN") return false;
  return true;
}

/** Submitter transitions: resubmit (-> PENDING) and withdraw (-> WITHDRAWN). */
export function canResubmit(from: ReviewStatus): boolean {
  return RESUBMITTABLE_REVIEW_STATUSES.includes(from);
}

export function canWithdraw(from: ReviewStatus): boolean {
  return WITHDRAWABLE_REVIEW_STATUSES.includes(from);
}

export function canEditSubmission(from: ReviewStatus): boolean {
  return EDITABLE_REVIEW_STATUSES.includes(from);
}

/**
 * Mutation status transitions preserve scientific history: every status can be
 * revisited (e.g. KILLED -> SURVIVED when a test is reverted). Re-applying the
 * same value is rejected so the history stays meaningful.
 */
export function canTransitionMutation(from: MutationStatus, to: MutationStatus): boolean {
  return from !== to;
}

/** Maps a submitter's observed result to the initial mutation status. */
export function initialMutationStatus(observed: "SURVIVED" | "KILLED" | "UNKNOWN"): MutationStatus {
  return observed;
}

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  PENDING: "Pending review",
  NEEDS_INFORMATION: "Needs information",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  DUPLICATE: "Duplicate",
  WITHDRAWN: "Withdrawn",
};

export const MUTATION_STATUS_LABEL: Record<MutationStatus, string> = {
  UNKNOWN: "Unknown",
  SURVIVED: "Survived",
  KILLED: "Killed",
  EQUIVALENT: "Equivalent",
  INVALID: "Invalid",
};

export const VALIDATION_RESULT_LABEL: Record<ValidationResult, string> = {
  SURVIVED: "Survived",
  KILLED: "Killed",
  COULD_NOT_REPRODUCE: "Could not reproduce",
};

export const REVIEW_ACTION_LABEL: Record<ReviewAction, string> = {
  APPROVE: "Approve",
  REJECT: "Reject",
  NEEDS_INFORMATION: "Needs information",
  MARK_DUPLICATE: "Mark duplicate",
};
