import { describe, expect, it } from "vitest";
import {
  canEditSubmission,
  canResubmit,
  canTransitionMutation,
  canTransitionReview,
  canWithdraw,
  MUTATION_STATUS_ACTIVITY,
  REVIEW_ACTION_TO_STATUS,
  REVIEW_STATUS_ACTIVITY,
} from "@/domain/mutants/status";

describe("review transitions", () => {
  it("allows moving between moderation states", () => {
    expect(canTransitionReview("PENDING", "APPROVED")).toBe(true);
    expect(canTransitionReview("APPROVED", "REJECTED")).toBe(true);
    expect(canTransitionReview("NEEDS_INFORMATION", "APPROVED")).toBe(true);
  });
  it("rejects no-op and back-to-pending transitions", () => {
    expect(canTransitionReview("APPROVED", "APPROVED")).toBe(false);
    expect(canTransitionReview("REJECTED", "PENDING")).toBe(false);
  });
  it("keeps withdrawal in the submitter's hands", () => {
    expect(canTransitionReview("PENDING", "WITHDRAWN")).toBe(false);
    expect(canTransitionReview("WITHDRAWN", "APPROVED")).toBe(false);
    expect(canTransitionReview("WITHDRAWN", "REJECTED")).toBe(false);
  });
  it("maps actions to statuses and activities", () => {
    expect(REVIEW_ACTION_TO_STATUS.APPROVE).toBe("APPROVED");
    expect(REVIEW_ACTION_TO_STATUS.MARK_DUPLICATE).toBe("DUPLICATE");
    expect(REVIEW_STATUS_ACTIVITY.APPROVED).toBe("MUTANT_APPROVED");
    expect(REVIEW_STATUS_ACTIVITY.PENDING).toBeNull();
  });
});

describe("mutation transitions", () => {
  it("allows any change but not re-applying the same value", () => {
    expect(canTransitionMutation("SURVIVED", "KILLED")).toBe(true);
    expect(canTransitionMutation("KILLED", "SURVIVED")).toBe(true);
    expect(canTransitionMutation("EQUIVALENT", "EQUIVALENT")).toBe(false);
  });
  it("records killed / equivalent as dedicated activities", () => {
    expect(MUTATION_STATUS_ACTIVITY.KILLED).toBe("MUTANT_KILLED");
    expect(MUTATION_STATUS_ACTIVITY.EQUIVALENT).toBe("MUTANT_MARKED_EQUIVALENT");
    expect(MUTATION_STATUS_ACTIVITY.SURVIVED).toBe("MUTANT_STATUS_CHANGED");
  });
});

describe("submitter lifecycle", () => {
  it("allows editing only while the review is open", () => {
    expect(canEditSubmission("PENDING")).toBe(true);
    expect(canEditSubmission("NEEDS_INFORMATION")).toBe(true);
    expect(canEditSubmission("APPROVED")).toBe(false);
    expect(canEditSubmission("REJECTED")).toBe(false);
    expect(canEditSubmission("WITHDRAWN")).toBe(false);
  });
  it("allows resubmitting after needs-information or withdrawal", () => {
    expect(canResubmit("NEEDS_INFORMATION")).toBe(true);
    expect(canResubmit("WITHDRAWN")).toBe(true);
    expect(canResubmit("PENDING")).toBe(false);
    expect(canResubmit("APPROVED")).toBe(false);
  });
  it("allows withdrawing only pending submissions", () => {
    expect(canWithdraw("PENDING")).toBe(true);
    expect(canWithdraw("NEEDS_INFORMATION")).toBe(true);
    expect(canWithdraw("APPROVED")).toBe(false);
    expect(canWithdraw("DUPLICATE")).toBe(false);
  });
});
