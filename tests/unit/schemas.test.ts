import { describe, expect, it } from "vitest";
import { LIMITS } from "@/lib/validation/limits";
import {
  addMemberSchema,
  setProjectActiveSchema,
  createCommentSchema,
  createValidationSchema,
  editDescriptionSchema,
  editMutantSchema,
  withdrawMutantSchema,
  fieldErrors,
  mutantListFilterSchema,
  registerProjectSchema,
  reviewMutantSchema,
  submitMutantSchema,
  githubUsernameSchema,
} from "@/lib/validation/schemas";

const validSubmission = {
  projectId: "p1",
  commitSha: "9b2e4d6f8a0c1e3b5d7f9a1c3e5b7d9f1a3c5e7b",
  filePath: "src/script/interpreter.cpp",
  startLine: "60",
  endLine: "60",
  title: "Off by one",
  mutationOperator: "RELATIONAL_OPERATOR",
  originalCode: "if (a <= 75)",
  mutatedCode: "if (a < 75)",
  gitDiff: "",
  testCommand: "ctest",
  environmentDescription: "Ubuntu 24.04",
  observedResult: "SURVIVED",
  testDurationSeconds: "",
};

describe("submitMutantSchema", () => {
  it("accepts a valid submission and coerces numbers", () => {
    const parsed = submitMutantSchema.parse(validSubmission);
    expect(parsed.startLine).toBe(60);
    expect(parsed.testDurationSeconds).toBeUndefined();
    expect(parsed.description).toBeUndefined();
  });

  it("accepts submissions without a title or environment", () => {
    const parsed = submitMutantSchema.parse({
      ...validSubmission,
      title: "",
      environmentDescription: "   ",
    });
    expect(parsed.title).toBeUndefined();
    expect(parsed.environmentDescription).toBeUndefined();
  });

  it("accepts an empty mutated code as a deletion", () => {
    const parsed = submitMutantSchema.parse({ ...validSubmission, mutatedCode: "" });
    expect(parsed.mutatedCode).toBe("");
    const { mutatedCode: _omitted, ...withoutField } = validSubmission;
    void _omitted;
    expect(submitMutantSchema.parse(withoutField).mutatedCode).toBe("");
  });

  it("rejects identical original and mutated code", () => {
    const result = submitMutantSchema.safeParse({
      ...validSubmission,
      mutatedCode: "if (a <= 75)",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error).mutatedCode).toMatch(/differ/);
  });

  it("rejects path traversal and absolute paths", () => {
    expect(
      submitMutantSchema.safeParse({ ...validSubmission, filePath: "../etc/passwd" }).success,
    ).toBe(false);
    expect(
      submitMutantSchema.safeParse({ ...validSubmission, filePath: "/etc/passwd" }).success,
    ).toBe(false);
  });

  it("rejects invalid commit SHAs and line ranges", () => {
    expect(
      submitMutantSchema.safeParse({ ...validSubmission, commitSha: "not-a-sha" }).success,
    ).toBe(false);
    const range = submitMutantSchema.safeParse({
      ...validSubmission,
      startLine: "10",
      endLine: "5",
    });
    expect(range.success).toBe(false);
    if (!range.success) expect(fieldErrors(range.error).endLine).toBeDefined();
  });

  it("enforces size limits", () => {
    const big = "x".repeat(LIMITS.diff + 1);
    expect(submitMutantSchema.safeParse({ ...validSubmission, gitDiff: big }).success).toBe(false);
  });
});

describe("other schemas", () => {
  it("validates comments", () => {
    expect(createCommentSchema.safeParse({ mutantId: "1", body: "   " }).success).toBe(false);
    expect(createCommentSchema.parse({ mutantId: "1", body: "ok" })).toEqual({
      mutantId: 1,
      body: "ok",
    });
  });

  it("treats missing optional numbers as undefined", () => {
    const parsed = reviewMutantSchema.parse({ mutantId: "3", action: "APPROVE", comment: "" });
    expect(parsed.duplicateOfId).toBeUndefined();
    const { testDurationSeconds: _d, ...withoutDuration } = validSubmission;
    void _d;
    expect(submitMutantSchema.parse(withoutDuration).testDurationSeconds).toBeUndefined();
    expect(
      submitMutantSchema.parse({ ...validSubmission, testDurationSeconds: "90" })
        .testDurationSeconds,
    ).toBe(90);
  });

  it("validates review input", () => {
    const parsed = reviewMutantSchema.parse({
      mutantId: "3",
      action: "MARK_DUPLICATE",
      duplicateOfId: "1",
      comment: "",
    });
    expect(parsed).toEqual({
      mutantId: 3,
      action: "MARK_DUPLICATE",
      duplicateOfId: 1,
      comment: undefined,
    });
    expect(reviewMutantSchema.safeParse({ mutantId: "3", action: "DELETE" }).success).toBe(false);
  });

  it("validates repository slugs", () => {
    expect(registerProjectSchema.safeParse({ repository: "curl/curl" }).success).toBe(true);
    expect(
      registerProjectSchema.safeParse({ repository: "https://github.com/curl/curl" }).success,
    ).toBe(false);
  });

  it("applies defaults and bounds to list filters", () => {
    expect(mutantListFilterSchema.parse({})).toMatchObject({ page: 1, pageSize: 25 });
    expect(mutantListFilterSchema.safeParse({ pageSize: "1000" }).success).toBe(false);
  });
});

describe("lifecycle schemas", () => {
  it("edits keep the location out of the payload and reuse the code rule", () => {
    const {
      projectId: _p,
      commitSha: _c,
      filePath: _f,
      startLine: _s,
      endLine: _e,
      ...rest
    } = validSubmission;
    void [_p, _c, _f, _s, _e];
    const parsed = editMutantSchema.parse({ ...rest, mutantId: "12", editReason: " fixed diff " });
    expect(parsed.mutantId).toBe(12);
    expect(parsed.editReason).toBe("fixed diff");
    expect(
      editMutantSchema.safeParse({ ...rest, mutantId: "12", mutatedCode: rest.originalCode })
        .success,
    ).toBe(false);
  });

  it("description edits trim, clear on empty and enforce the limit", () => {
    expect(editDescriptionSchema.parse({ mutantId: "4", description: " Why it matters " })).toEqual(
      { mutantId: 4, description: "Why it matters" },
    );
    expect(editDescriptionSchema.parse({ mutantId: "4", description: "  " })).toEqual({
      mutantId: 4,
      description: undefined,
    });
    expect(
      editDescriptionSchema.safeParse({
        mutantId: "4",
        description: "x".repeat(LIMITS.description + 1),
      }).success,
    ).toBe(false);
  });

  it("withdrawals accept an optional reason", () => {
    expect(withdrawMutantSchema.parse({ mutantId: "3", reason: "" })).toEqual({
      mutantId: 3,
      reason: undefined,
    });
  });

  it("validations accept a killing test reference within limits", () => {
    const ok = createValidationSchema.parse({
      mutantId: "1",
      result: "KILLED",
      killingTestRef: "tests/unit/unit1300.c",
    });
    expect(ok.killingTestRef).toBe("tests/unit/unit1300.c");
    expect(
      createValidationSchema.safeParse({
        mutantId: "1",
        result: "KILLED",
        killingTestRef: "x".repeat(501),
      }).success,
    ).toBe(false);
  });
});

describe("project settings schemas", () => {
  it("normalises usernames and validates roles", () => {
    expect(
      addMemberSchema.parse({ projectId: "p", username: "@Octocat ", role: "REVIEWER" }),
    ).toEqual({
      projectId: "p",
      username: "octocat",
      role: "REVIEWER",
    });
    expect(
      addMemberSchema.safeParse({ projectId: "p", username: "not a user", role: "REVIEWER" })
        .success,
    ).toBe(false);
    expect(
      addMemberSchema.safeParse({ projectId: "p", username: "octocat", role: "ADMIN" }).success,
    ).toBe(false);
  });

  it("parses the active flag from form strings", () => {
    expect(setProjectActiveSchema.parse({ projectId: "p", isActive: "false" }).isActive).toBe(
      false,
    );
    expect(setProjectActiveSchema.parse({ projectId: "p", isActive: true }).isActive).toBe(true);
  });
});

// Added from the mutation-testing report: kills mutants that survived the original tests.
describe("schema transforms", () => {
  it("normalises usernames, commit case and booleans", () => {
    expect(githubUsernameSchema.parse("@BrunoErg")).toBe("brunoerg");
    expect(githubUsernameSchema.parse("plain")).toBe("plain");
    expect(() => githubUsernameSchema.parse("@@x")).toThrow();
    const v = createValidationSchema.parse({
      mutantId: "1",
      result: "KILLED",
      commitSha: "ABCDEF1",
    });
    expect(v.commitSha).toBe("abcdef1");
    expect(setProjectActiveSchema.parse({ projectId: "p", isActive: "false" }).isActive).toBe(
      false,
    );
    expect(setProjectActiveSchema.parse({ projectId: "p", isActive: "true" }).isActive).toBe(true);
    expect(setProjectActiveSchema.parse({ projectId: "p", isActive: true }).isActive).toBe(true);
  });

  it("maps issues to fields, keeping the first message and a _form key for root issues", () => {
    const result = submitMutantSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = fieldErrors(result.error);
      expect(errors.filePath).toBeDefined();
      expect(Object.keys(errors)).not.toContain("_form");
    }
    const identical = submitMutantSchema.safeParse({
      projectId: "p",
      commitSha: "abcdef1",
      filePath: "a.c",
      startLine: "1",
      endLine: "1",
      mutationOperator: "UNKNOWN",
      originalCode: "x",
      mutatedCode: "x ",
      testCommand: "t",
      observedResult: "SURVIVED",
    });
    if (!identical.success)
      expect(fieldErrors(identical.error)).toEqual({
        mutatedCode: expect.stringMatching(/differ/),
      });
  });
});
