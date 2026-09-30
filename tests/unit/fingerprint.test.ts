import { describe, expect, it } from "vitest";
import {
  computeFingerprint,
  computeSimilarityKey,
  extractSimilarityContext,
  normalizeCode,
} from "@/domain/mutants/fingerprint";

const base = {
  projectId: "proj",
  revisionId: "rev",
  filePath: "src/a.c",
  startLine: 10,
  originalCode: "if (x > 1) {",
  mutatedCode: "if (x >= 1) {",
};

describe("normalizeCode", () => {
  it("ignores indentation, trailing whitespace, CRLF and blank lines", () => {
    expect(normalizeCode("  if (x > 1) {  \r\n\r\n\t  return;\n")).toBe("if (x > 1) {\nreturn;");
  });

  it("collapses internal whitespace runs", () => {
    expect(normalizeCode("a   +   b")).toBe("a + b");
  });
});

describe("computeFingerprint", () => {
  it("is stable for the same input", () => {
    expect(computeFingerprint(base)).toBe(computeFingerprint({ ...base }));
    expect(computeFingerprint(base)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("treats cosmetic differences as duplicates", () => {
    const a = computeFingerprint(base);
    const b = computeFingerprint({
      ...base,
      originalCode: "    if (x > 1) {   ",
      mutatedCode: "\tif (x >= 1) {\r\n",
    });
    expect(a).toBe(b);
  });

  it("changes when the revision changes", () => {
    expect(computeFingerprint(base)).not.toBe(computeFingerprint({ ...base, revisionId: "other" }));
  });

  it("changes when the start line changes (repeated statements are distinct mutants)", () => {
    expect(computeFingerprint(base)).not.toBe(computeFingerprint({ ...base, startLine: 11 }));
  });

  it("changes when the file, project or code changes", () => {
    expect(computeFingerprint(base)).not.toBe(computeFingerprint({ ...base, filePath: "src/b.c" }));
    expect(computeFingerprint(base)).not.toBe(computeFingerprint({ ...base, projectId: "p2" }));
    expect(computeFingerprint(base)).not.toBe(
      computeFingerprint({ ...base, mutatedCode: "if (x < 1) {" }),
    );
  });

  it("is not fooled by separator injection", () => {
    const sep = String.fromCharCode(0x1f);
    const a = computeFingerprint({ ...base, filePath: "a", originalCode: `b${sep}c` });
    const b = computeFingerprint({ ...base, filePath: `a${sep}b`, originalCode: "c" });
    expect(a).not.toBe(b);
  });
});

describe("extractSimilarityContext", () => {
  const file = [
    "int f(void) {",
    "",
    "    if (!a) {",
    "        return 0;",
    "",
    "    }",
    "    x = 1;",
    "}",
  ].join("\n");

  it("takes the nearest non-blank lines on each side, normalized", () => {
    expect(extractSimilarityContext(file, 4, 4)).toEqual({
      before: ["int f(void) {", "if (!a) {"],
      after: ["}", "x = 1;"],
    });
  });

  it("stops at the file edges and spans multi-line mutants", () => {
    expect(extractSimilarityContext(file, 1, 1)).toEqual({
      before: [],
      after: ["if (!a) {", "return 0;"],
    });
    expect(extractSimilarityContext(file, 3, 6)).toEqual({
      before: ["int f(void) {"],
      after: ["x = 1;", "}"],
    });
    expect(extractSimilarityContext(file, 8, 8).after).toEqual([]);
  });

  it("ignores inserted blank lines and CRLF", () => {
    const spaced = file.replace("    if (!a) {", "\n\n    if (!a) {").replace(/\n/g, "\r\n");
    expect(extractSimilarityContext(spaced, 6, 6)).toEqual(extractSimilarityContext(file, 4, 4));
  });
});

describe("computeSimilarityKey", () => {
  const source = [
    "int a(void) {",
    "    if (!load(x)) {",
    "        return 0;",
    "    }",
    "    return 1;",
    "}",
    "int b(void) {",
    "    if (!parse(y)) {",
    "        return 0;",
    "    }",
    "    return 1;",
    "}",
  ].join("\n");
  const deletion = {
    projectId: "proj",
    filePath: "src/a.c",
    originalCode: "        return 0;",
    mutatedCode: "",
  };
  const at = (content: string, line: number) =>
    computeSimilarityKey({ ...deletion, context: extractSimilarityContext(content, line, line) });

  it("tells a repeated statement apart by its surroundings", () => {
    // Line 3 and line 9 delete the same `return 0;` in different functions.
    expect(at(source, 3)).not.toBe(at(source, 9));
  });

  it("links the same mutation after the code moved at a later commit", () => {
    const later = ["// new header", "#include <x.h>", "", source].join("\n");
    expect(at(later, 6)).toBe(at(source, 3));
    expect(at(later, 12)).toBe(at(source, 9));
  });

  it("changes with the project, file, code pair or context", () => {
    const context = extractSimilarityContext(source, 3, 3);
    const key = computeSimilarityKey({ ...deletion, context });
    expect(computeSimilarityKey({ ...deletion, context, filePath: "src/b.c" })).not.toBe(key);
    expect(computeSimilarityKey({ ...deletion, context, projectId: "other" })).not.toBe(key);
    expect(computeSimilarityKey({ ...deletion, context, mutatedCode: "return 1;" })).not.toBe(key);
    expect(
      computeSimilarityKey({ ...deletion, context: { ...context, after: ["}", "return 2;"] } }),
    ).not.toBe(key);
    // Indentation of the code pair does not matter.
    expect(computeSimilarityKey({ ...deletion, context, originalCode: "return 0;" })).toBe(key);
  });
});
