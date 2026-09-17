import { describe, expect, it } from "vitest";
import {
  canAccessReviewQueue,
  canChangeMutationStatus,
  canEditComment,
  canManageProject,
  canRegisterProject,
  canReviewProject,
  canSubmitMutant,
  isAdmin,
  isMutantOwner,
  reviewableProjectIds,
  type Principal,
  canComment,
  canValidateMutant,
} from "@/domain/auth/permissions";

const admin: Principal = { id: "admin", globalRole: "ADMIN", memberships: [] };
const reviewer: Principal = {
  id: "rev",
  globalRole: "USER",
  memberships: [{ projectId: "p1", role: "REVIEWER" }],
};
const maintainer: Principal = {
  id: "mnt",
  globalRole: "USER",
  memberships: [{ projectId: "p2", role: "MAINTAINER" }],
};
const contributor: Principal = {
  id: "ctb",
  globalRole: "USER",
  memberships: [{ projectId: "p1", role: "CONTRIBUTOR" }],
};
const nobody: Principal = { id: "nb", globalRole: "USER", memberships: [] };

describe("permissions", () => {
  it("admins can do everything", () => {
    expect(isAdmin(admin)).toBe(true);
    expect(canReviewProject(admin, "any")).toBe(true);
    expect(canManageProject(admin, "any")).toBe(true);
    expect(reviewableProjectIds(admin)).toBeNull();
  });

  it("reviewers and maintainers can review only their projects", () => {
    expect(canReviewProject(reviewer, "p1")).toBe(true);
    expect(canReviewProject(reviewer, "p2")).toBe(false);
    expect(canReviewProject(maintainer, "p2")).toBe(true);
    expect(canManageProject(reviewer, "p1")).toBe(false);
    expect(canManageProject(maintainer, "p2")).toBe(true);
    expect(reviewableProjectIds(reviewer)).toEqual(["p1"]);
  });

  it("contributors and anonymous users cannot review", () => {
    expect(canReviewProject(contributor, "p1")).toBe(false);
    expect(canAccessReviewQueue(contributor)).toBe(false);
    expect(canAccessReviewQueue(null)).toBe(false);
    expect(reviewableProjectIds(nobody)).toEqual([]);
    expect(canChangeMutationStatus(contributor, "p1")).toBe(false);
  });

  it("project registration is admin-only by default and opt-in for everyone", () => {
    expect(canRegisterProject(admin)).toBe(true);
    expect(canRegisterProject(contributor)).toBe(false);
    expect(canRegisterProject(maintainer, "admins")).toBe(false);
    expect(canRegisterProject(contributor, "users")).toBe(true);
    expect(canRegisterProject(null, "users")).toBe(false);
  });

  it("any signed-in user can submit; anonymous cannot", () => {
    expect(canSubmitMutant(nobody)).toBe(true);
    expect(canSubmitMutant(null)).toBe(false);
  });

  it("mutants are owned by their submitter; admins may act for anyone", () => {
    expect(isMutantOwner(contributor, { createdById: "ctb" })).toBe(true);
    expect(isMutantOwner(reviewer, { createdById: "ctb" })).toBe(false);
    expect(isMutantOwner(admin, { createdById: "ctb" })).toBe(true);
    expect(isMutantOwner(null, { createdById: "ctb" })).toBe(false);
  });

  it("comments can be edited by their author or a project reviewer", () => {
    expect(canEditComment(contributor, { userId: "ctb" }, "p1")).toBe(true);
    expect(canEditComment(nobody, { userId: "ctb" }, "p1")).toBe(false);
    expect(canEditComment(reviewer, { userId: "ctb" }, "p1")).toBe(true);
    expect(canEditComment(reviewer, { userId: "ctb" }, "p2")).toBe(false);
  });
});

// Added from the mutation-testing report: kills mutants that survived the original tests.
describe("permission edge cases", () => {
  const principal = (
    memberships: Principal["memberships"],
    globalRole: Principal["globalRole"] = "USER",
  ): Principal => ({
    id: "u",
    globalRole,
    memberships,
  });

  it("only reviewer and maintainer memberships open the queue", () => {
    const contributor = principal([{ projectId: "p1", role: "CONTRIBUTOR" }]);
    expect(canAccessReviewQueue(contributor)).toBe(false);
    expect(reviewableProjectIds(contributor)).toEqual([]);
    const mixed = principal([
      { projectId: "p1", role: "CONTRIBUTOR" },
      { projectId: "p2", role: "REVIEWER" },
      { projectId: "p3", role: "MAINTAINER" },
    ]);
    expect(canAccessReviewQueue(mixed)).toBe(true);
    expect(reviewableProjectIds(mixed)).toEqual(["p2", "p3"]);
    expect(canReviewProject(mixed, "p1")).toBe(false);
    expect(reviewableProjectIds(principal([], "ADMIN"))).toBeNull();
    expect(reviewableProjectIds(null)).toEqual([]);
  });

  it("anonymous users can neither reproduce nor comment; the registration default is admins", () => {
    expect(canValidateMutant(null)).toBe(false);
    expect(canComment(undefined)).toBe(false);
    expect(canValidateMutant(principal([]))).toBe(true);
    expect(canComment(principal([]))).toBe(true);
    expect(canRegisterProject(principal([]))).toBe(false);
    expect(canRegisterProject(principal([], "ADMIN"))).toBe(true);
  });
});
