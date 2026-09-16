import { describe, expect, it } from "vitest";
import {
  changedRangesFromPatch,
  countChangedLines,
  isLineInRanges,
  mergeRanges,
  mutantTouchesDiff,
  parseChangedRanges,
  formatRanges,
  rangeContaining,
  spanWithinRanges,
  type LineRange,
} from "@/domain/pull-requests/diff-ranges";
import { buildCheckSummary, type CheckMutant } from "@/domain/pull-requests/check-summary";

const patch = [
  "@@ -10,4 +10,6 @@ int f(int a)",
  " context",
  "-old line",
  "+new line one",
  "+new line two",
  " context",
  "+added later",
  " context",
  "@@ -40,2 +42,3 @@",
  " ctx",
  "+tail",
  " ctx",
  "\\ No newline at end of file",
].join("\n");

describe("changedRangesFromPatch", () => {
  it("returns head-side ranges for added or modified lines only", () => {
    expect(changedRangesFromPatch(patch)).toEqual([
      [11, 12],
      [14, 14],
      [43, 43],
    ]);
  });
  it("handles empty or missing patches (binary, huge files)", () => {
    expect(changedRangesFromPatch(undefined)).toEqual([]);
    expect(changedRangesFromPatch("")).toEqual([]);
  });
});

describe("range helpers", () => {
  it("merges overlapping and adjacent ranges", () => {
    expect(
      mergeRanges([
        [5, 6],
        [1, 2],
        [3, 4],
        [10, 12],
        [11, 15],
      ]),
    ).toEqual([
      [1, 6],
      [10, 15],
    ]);
  });
  it("tests membership and counts lines", () => {
    expect(isLineInRanges(3, [[1, 4]])).toBe(true);
    expect(isLineInRanges(5, [[1, 4]])).toBe(false);
    expect(isLineInRanges(5, undefined)).toBe(false);
    expect(
      countChangedLines([
        [1, 4],
        [10, 10],
      ]),
    ).toBe(5);
  });
  it("detects mutants touching the diff", () => {
    const changed = { "lib/url.c": [[105, 125] as [number, number]] };
    expect(
      mutantTouchesDiff({ filePath: "lib/url.c", startLine: 120, endLine: 120 }, changed),
    ).toBe(true);
    expect(
      mutantTouchesDiff({ filePath: "lib/url.c", startLine: 100, endLine: 106 }, changed),
    ).toBe(true);
    expect(
      mutantTouchesDiff({ filePath: "lib/url.c", startLine: 200, endLine: 201 }, changed),
    ).toBe(false);
    expect(
      mutantTouchesDiff({ filePath: "lib/other.c", startLine: 110, endLine: 110 }, changed),
    ).toBe(false);
  });
  it("sanitises stored JSON", () => {
    expect(
      parseChangedRanges({
        "a.c": [
          [1, 3],
          [2, 5],
          ["x", 1],
          [9, 4],
        ],
        bad: "no",
      }),
    ).toEqual({
      "a.c": [[1, 5]],
    });
    expect(parseChangedRanges(null)).toEqual({});
  });
});

describe("spanWithinRanges / rangeContaining / formatRanges", () => {
  const ranges: LineRange[] = [
    [115, 121],
    [130, 134],
    [122, 123],
  ];
  it("accepts spans fully inside a changed block and rejects the rest", () => {
    expect(spanWithinRanges(117, 117, ranges)).toBe(true);
    expect(spanWithinRanges(115, 123, ranges)).toBe(true); // adjacent blocks merge
    expect(spanWithinRanges(121, 130, ranges)).toBe(false); // crosses unchanged lines
    expect(spanWithinRanges(30, 30, ranges)).toBe(false);
    expect(spanWithinRanges(118, 117, ranges)).toBe(false);
    expect(spanWithinRanges(1, 1, [])).toBe(false);
  });
  it("finds the containing block and formats ranges", () => {
    expect(rangeContaining(122, ranges)).toEqual([115, 123]);
    expect(rangeContaining(125, ranges)).toBeNull();
    expect(formatRanges(ranges)).toBe("115–123, 130–134");
    expect(formatRanges([[7, 7]])).toBe("7");
  });
});

describe("buildCheckSummary", () => {
  const changed = { "lib/url.c": [[100, 130] as [number, number]] };
  const base: CheckMutant = {
    id: 1,
    title: "Port | boundary",
    filePath: "lib/url.c",
    startLine: 117,
    endLine: 117,
    reviewStatus: "APPROVED",
    mutationStatus: "SURVIVED",
    validations: 2,
    commitSha: "head",
  };

  it("reports an empty state with a success conclusion", () => {
    const s = buildCheckSummary({ number: 7, headSha: "head" }, [], changed, "https://mh.test");
    expect(s.conclusion).toBe("success");
    expect(s.counts.onDiff).toBe(0);
    expect(s.text).toContain("No mutants on the changed lines");
  });

  it("counts mutants on the diff, ignores rejected ones, and never blocks", () => {
    const s = buildCheckSummary(
      { number: 7, headSha: "head" },
      [
        base,
        { ...base, id: 2, mutationStatus: "KILLED", commitSha: "older" },
        { ...base, id: 3, reviewStatus: "REJECTED" },
        { ...base, id: 4, startLine: 300, endLine: 300 },
        { ...base, id: 5, reviewStatus: "PENDING", mutationStatus: "EQUIVALENT" },
      ],
      changed,
      "https://mh.test",
    );
    expect(s.conclusion).toBe("neutral");
    expect(s.counts).toEqual({
      onDiff: 3,
      surviving: 1,
      killed: 1,
      equivalent: 1,
      pendingReview: 1,
      offDiff: 1,
      olderHead: 1,
    });
    expect(s.title).toBe("1 surviving, 1 killed, 1 equivalent on changed lines");
    expect(s.text).toContain("[#1](https://mh.test/mutants/1) Port \\| boundary");
    expect(s.text).toContain("(earlier head)");
    expect(s.text).toContain(
      "1 more mutant recorded on this pull request outside the changed lines",
    );
    expect(s.text).not.toContain("#3");
  });
});
