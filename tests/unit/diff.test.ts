import { describe, expect, it } from "vitest";
import {
  extractDiffFilePath,
  generateUnifiedDiff,
  looksLikeUnifiedDiff,
  parseDiffStats,
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
