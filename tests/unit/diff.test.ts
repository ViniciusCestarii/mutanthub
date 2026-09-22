import { describe, expect, it } from "vitest";
import {
  extractDiffFilePath,
  generateUnifiedDiff,
  looksLikeUnifiedDiff,
  parseDiffStats,
  splitUnifiedDiff,
} from "@/domain/mutants/diff";

const sample = `--- a/src/x.c
+++ b/src/x.c
@@ -10,2 +10,2 @@
 context
-if (a > b)
+if (a >= b)
`;

describe("parseDiffStats", () => {
  it("counts additions, deletions, hunks and files", () => {
    expect(parseDiffStats(sample)).toEqual({
      additions: 1,
      deletions: 1,
      hunks: 1,
      files: ["src/x.c"],
    });
  });

  it("does not count file headers as changes", () => {
    const stats = parseDiffStats("--- a/f\n+++ b/f\n@@ -1 +1 @@\n-x\n+y\n");
    expect(stats.additions).toBe(1);
    expect(stats.deletions).toBe(1);
  });
});

describe("looksLikeUnifiedDiff", () => {
  it("accepts hunks and +/- lines", () => {
    expect(looksLikeUnifiedDiff(sample)).toBe(true);
    expect(looksLikeUnifiedDiff("-a\n+b")).toBe(true);
  });
  it("rejects empty or plain text", () => {
    expect(looksLikeUnifiedDiff("")).toBe(false);
    expect(looksLikeUnifiedDiff("hello world")).toBe(false);
  });
});

describe("generateUnifiedDiff", () => {
  it("builds a hunk replacing the original block", () => {
    const diff = generateUnifiedDiff({
      filePath: "lib/url.c",
      startLine: 117,
      originalCode: "    if(value > MAX_PORT)",
      mutatedCode: "    if(value >= MAX_PORT)",
    });
    expect(diff).toBe(
      "--- a/lib/url.c\n+++ b/lib/url.c\n@@ -117,1 +117,1 @@\n-    if(value > MAX_PORT)\n+    if(value >= MAX_PORT)\n",
    );
    expect(looksLikeUnifiedDiff(diff)).toBe(true);
    expect(extractDiffFilePath(diff)).toBe("lib/url.c");
  });

  it("handles multi-line and deletion-only blocks", () => {
    const diff = generateUnifiedDiff({
      filePath: "a.c",
      startLine: 3,
      originalCode: "x;\ny;\n",
      mutatedCode: "",
    });
    expect(diff).toContain("@@ -3,2 +3,0 @@");
    expect(parseDiffStats(diff)).toMatchObject({ additions: 0, deletions: 2 });
  });
});

describe("splitUnifiedDiff", () => {
  it("keeps context lines on both sides", () => {
    expect(splitUnifiedDiff(sample)).toEqual({
      original: "context\nif (a > b)",
      modified: "context\nif (a >= b)",
    });
  });

  it("separates hunks with an ellipsis and drops file headers", () => {
    const diff =
      "diff --git a/f b/f\nindex 111..222 100644\n--- a/f\n+++ b/f\n@@ -1,2 +1,2 @@\n a\n-b\n+B\n@@ -9,2 +9,2 @@\n y\n-z\n+Z\n";
    expect(splitUnifiedDiff(diff)).toEqual({
      original: "a\nb\n…\ny\nz",
      modified: "a\nB\n…\ny\nZ",
    });
  });

  it("returns null for text that is not a diff", () => {
    expect(splitUnifiedDiff("just code")).toBeNull();
    expect(splitUnifiedDiff("")).toBeNull();
  });
});

// Added from the mutation-testing report: kills mutants that survived the original tests.
describe("diff helpers edge cases", () => {
  it("reads file names from CRLF diffs and skips /dev/null", () => {
    const diff = "--- /dev/null\r\n+++ b/lib/new.c\r\n@@ -0,0 +1,2 @@\r\n+a\r\n+b\r\n";
    expect(parseDiffStats(diff)).toMatchObject({
      additions: 2,
      deletions: 0,
      files: ["lib/new.c"],
    });
    expect(extractDiffFilePath("+++ b/x.c\n")).toBe("x.c");
    expect(extractDiffFilePath("+++ /dev/null\n")).toBeNull();
    expect(extractDiffFilePath("+++   b/spaced.c  \n")).toBe("spaced.c");
  });

  it("recognises +/- bodies without hunk headers and rejects header-only text", () => {
    expect(looksLikeUnifiedDiff("-old\n+new")).toBe(true);
    expect(looksLikeUnifiedDiff("--- a\n+++ b")).toBe(false);
    expect(looksLikeUnifiedDiff("   \n")).toBe(false);
    expect(looksLikeUnifiedDiff("note: +1 here")).toBe(false);
  });

  it("strips leading slashes and normalises CRLF when generating a patch", () => {
    const diff = generateUnifiedDiff({
      filePath: "//lib/a.c",
      startLine: 3,
      originalCode: "x;\r\ny;\r\n",
      mutatedCode: "z;\r\n",
    });
    expect(diff).toBe("--- a/lib/a.c\n+++ b/lib/a.c\n@@ -3,2 +3,1 @@\n-x;\n-y;\n+z;\n");
  });
});
