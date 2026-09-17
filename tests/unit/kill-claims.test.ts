import { describe, expect, it } from "vitest";
import { locateOriginalCode } from "@/domain/kill-claims/applies";
import {
  looksLikeTestPath,
  parseKillReference,
  referenceLabel,
} from "@/domain/kill-claims/reference";
import { evaluateClaim } from "@/domain/kill-claims/status";

describe("parseKillReference", () => {
  it("recognises pull requests by number or URL", () => {
    expect(parseKillReference("#123")).toEqual({
      reference: { kind: "PULL_REQUEST", number: 123 },
      repository: null,
    });
    expect(parseKillReference("123")?.reference).toEqual({ kind: "PULL_REQUEST", number: 123 });
    expect(parseKillReference("PR #9")?.reference).toEqual({ kind: "PULL_REQUEST", number: 9 });
    expect(parseKillReference("https://github.com/curl/curl/pull/15908/files")).toEqual({
      reference: { kind: "PULL_REQUEST", number: 15908 },
      repository: { owner: "curl", repo: "curl" },
    });
  });

  it("recognises commits by SHA or URL", () => {
    expect(parseKillReference("E8D1C4B7")?.reference).toEqual({ kind: "COMMIT", sha: "e8d1c4b7" });
    expect(parseKillReference("https://github.com/curl/curl/commit/e8d1c4b7a2f5")).toEqual({
      reference: { kind: "COMMIT", sha: "e8d1c4b7a2f5" },
      repository: { owner: "curl", repo: "curl" },
    });
  });

  it("recognises test paths and rejects junk", () => {
    expect(parseKillReference("tests/unit/unit1300.c")?.reference).toEqual({
      kind: "TEST_PATH",
      path: "tests/unit/unit1300.c",
    });
    expect(parseKillReference("src/test/script_tests.cpp::MinimalPush")?.reference.kind).toBe(
      "TEST_PATH",
    );
    expect(parseKillReference("")).toBeNull();
    expect(parseKillReference("../etc/passwd")).toBeNull();
    expect(parseKillReference("/absolute/path")).toBeNull();
    expect(parseKillReference("not a ref!")).toBeNull();
  });

  it("labels references and spots test paths", () => {
    expect(referenceLabel("PULL_REQUEST", "12")).toBe("PR #12");
    expect(referenceLabel("COMMIT", "e8d1c4b7a2f5")).toBe("commit e8d1c4b");
    expect(looksLikeTestPath("tests/unit/unit1300.c")).toBe(true);
    expect(looksLikeTestPath("src/test/script_tests.cpp")).toBe(true);
    expect(looksLikeTestPath("llvm/unittests/Support/APIntTest.cpp")).toBe(true);
    expect(looksLikeTestPath("lib/url.c")).toBe(false);
  });
});

describe("locateOriginalCode", () => {
  const file = ["int a;", "", "  if (value > MAX_PORT)", "    return 1;", "int b;"].join("\n");

  it("finds the code at the expected line", () => {
    expect(locateOriginalCode(file, "if (value > MAX_PORT)", 3)).toEqual({
      applies: "APPLIES",
      line: 3,
    });
  });
  it("reports moved code with its new line, ignoring whitespace", () => {
    expect(locateOriginalCode(file, "if (value   >  MAX_PORT)", 1)).toEqual({
      applies: "MOVED",
      line: 3,
    });
  });
  it("matches multi-line originals across blank lines", () => {
    expect(locateOriginalCode(file, "if (value > MAX_PORT)\nreturn 1;", 3)).toEqual({
      applies: "APPLIES",
      line: 3,
    });
  });
  it("reports absent code", () => {
    expect(locateOriginalCode(file, "if (value >= MAX_PORT)", 3)).toEqual({
      applies: "NOT_FOUND",
      line: null,
    });
    expect(locateOriginalCode(file, "", 3).applies).toBe("NOT_FOUND");
  });
});

describe("evaluateClaim", () => {
  it("stays claimed without enough evidence", () => {
    expect(evaluateClaim({ results: [], prState: "OPEN" })).toBe("CLAIMED");
    expect(evaluateClaim({ results: ["KILLED"], prState: "MERGED" })).toBe("CLAIMED");
    expect(evaluateClaim({ results: ["COULD_NOT_REPRODUCE"], prState: null })).toBe("CLAIMED");
  });
  it("verifies with two independent kills and no survival", () => {
    expect(evaluateClaim({ results: ["KILLED", "KILLED"], prState: "MERGED" })).toBe("VERIFIED");
    expect(evaluateClaim({ results: ["KILLED", "KILLED", "SURVIVED"], prState: "MERGED" })).toBe(
      "CLAIMED",
    );
  });
  it("refutes on survival and goes stale when the PR is closed unmerged", () => {
    expect(evaluateClaim({ results: ["SURVIVED"], prState: "MERGED" })).toBe("REFUTED");
    expect(evaluateClaim({ results: ["KILLED", "KILLED"], prState: "CLOSED" })).toBe("STALE");
  });
});

// Added from the mutation-testing report: kills mutants that survived the original tests.
describe("locateOriginalCode edge cases", () => {
  it("normalises CRLF, rejects blank targets and scans when the hint is out of range", () => {
    const crlf = "int a;\r\n  if (x > 1)\r\n    return 1;\r\n";
    expect(locateOriginalCode(crlf, "if (x > 1)", 2)).toEqual({ applies: "APPLIES", line: 2 });
    expect(locateOriginalCode(crlf, "   \n  ", 2).applies).toBe("NOT_FOUND");
    expect(locateOriginalCode(crlf, "if (x > 1)", 0)).toEqual({ applies: "MOVED", line: 2 });
    expect(locateOriginalCode(crlf, "if (x > 1)", 99)).toEqual({ applies: "MOVED", line: 2 });
  });

  it("requires every line of a multi-line target, in order", () => {
    const file = "a;\nb;\nc;\n";
    expect(locateOriginalCode(file, "b;\nc;", 2)).toEqual({ applies: "APPLIES", line: 2 });
    expect(locateOriginalCode(file, "b;\nz;", 2).applies).toBe("NOT_FOUND");
    expect(locateOriginalCode(file, "c;\nb;", 2).applies).toBe("NOT_FOUND");
    expect(locateOriginalCode(file, "c;\nd;", 3).applies).toBe("NOT_FOUND"); // runs past the end
  });
});
