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

// Added from the mutation-testing report: kills mutants that survived the original tests.
describe("check summary details", () => {
  const pr = { number: 7, headSha: "head" };
  const changed = { "lib/a.c": [[10, 20]] as Array<[number, number]> };
  const mutant = (id: number, over: Partial<CheckMutant> = {}): CheckMutant => ({
    id,
    title: `m${id}`,
    filePath: "lib/a.c",
    startLine: 12,
    endLine: 12,
    reviewStatus: "APPROVED",
    mutationStatus: "SURVIVED",
    validations: 0,
    commitSha: "head",
    ...over,
  });

  it("explains an empty diff and links to the browser", () => {
    const s = buildCheckSummary(pr, [], changed, "https://mh");
    expect(s.title).toBe("No mutants recorded on the changed lines yet");
    expect(s.text).toContain("No mutants on the changed lines. [Suggest one](https://mh/projects)");
    expect(s.text).not.toContain("| Mutant |");
  });

  it("caps the table at 50 rows and counts the rest", () => {
    const fifty = Array.from({ length: 50 }, (_, i) => mutant(i + 1));
    expect(buildCheckSummary(pr, fifty, changed, "https://mh").text).not.toContain("more |");
    const fiftyOne = [...fifty, mutant(51)];
    const text = buildCheckSummary(pr, fiftyOne, changed, "https://mh").text;
    expect(text).toContain("| ... | 1 more | | | |");
    expect(text).not.toContain("[#51]");
  });

  it("marks mutants from an earlier head and counts them", () => {
    const s = buildCheckSummary(pr, [mutant(1, { commitSha: "old" }), mutant(2)], changed, "h");
    expect(s.counts.olderHead).toBe(1);
    expect(s.text).toContain("`lib/a.c:12` (earlier head)");
    expect(s.text).toContain("1 of the listed mutants refer to an earlier head");
    const none = buildCheckSummary(pr, [mutant(2)], changed, "h");
    expect(none.text).not.toContain("earlier head");
  });

  it("reports mutants outside the diff with correct pluralisation", () => {
    const off = (id: number) => mutant(id, { startLine: 99, endLine: 99 });
    const one = buildCheckSummary(pr, [mutant(1), off(2)], changed, "h");
    expect(one.counts.offDiff).toBe(1);
    expect(one.text).toContain("1 more mutant recorded on this pull request outside");
    const two = buildCheckSummary(pr, [mutant(1), off(2), off(3)], changed, "h");
    expect(two.text).toContain("2 more mutants recorded on this pull request outside");
    expect(buildCheckSummary(pr, [mutant(1)], changed, "h").text).not.toContain("outside the");
  });

  it("adds a killing-test section only when there are claims", () => {
    const without = buildCheckSummary(pr, [mutant(1)], changed, "h");
    expect(without.text).not.toContain("Killing-test claims");
    const withClaims = buildCheckSummary(pr, [mutant(1)], changed, "h", [
      { mutantId: 1, mutantTitle: "m1", status: "CLAIMED", applies: "APPLIES" },
    ]);
    expect(withClaims.text).toContain("### Killing-test claims");
    expect(withClaims.text).toContain("reported to add tests that kill");
  });
});

// Added from the mutation-testing report: kills mutants that survived the original tests.
describe("diff range boundaries", () => {
  it("parses hunk headers without counts and ignores lines before the first hunk", () => {
    const patch = [
      "garbage +1",
      "@@ -1 +1 @@",
      "+only",
      "@@ -5,2 +7,3 @@",
      " ctx",
      "+a",
      "-b",
      "+c",
      "\\ No newline at end of file",
    ].join("\n");
    expect(changedRangesFromPatch(patch)).toEqual([
      [1, 1],
      [8, 9],
    ]);
    expect(changedRangesFromPatch("@@ -1,2 +3,2 @@\r\n+x\r\n+y\r\n")).toEqual([[3, 4]]);
  });

  it("treats range ends as inclusive", () => {
    const ranges: Array<[number, number]> = [[10, 20]];
    expect(isLineInRanges(10, ranges)).toBe(true);
    expect(isLineInRanges(20, ranges)).toBe(true);
    expect(isLineInRanges(9, ranges)).toBe(false);
    expect(isLineInRanges(21, ranges)).toBe(false);
    expect(isLineInRanges(15, undefined)).toBe(false);
    expect(rangeContaining(10, ranges)).toEqual([10, 20]);
    expect(rangeContaining(20, ranges)).toEqual([10, 20]);
    expect(rangeContaining(21, ranges)).toBeNull();
    const at = (startLine: number, endLine: number) =>
      mutantTouchesDiff({ filePath: "f", startLine, endLine }, { f: ranges });
    expect(at(5, 10)).toBe(true);
    expect(at(20, 25)).toBe(true);
    expect(at(5, 9)).toBe(false);
    expect(at(21, 25)).toBe(false);
    expect(mutantTouchesDiff({ filePath: "g", startLine: 10, endLine: 10 }, { f: ranges })).toBe(
      false,
    );
  });

  it("drops malformed ranges when reading from JSON", () => {
    expect(
      parseChangedRanges({
        ok: [
          [1, 2],
          [3, 3],
        ],
        bad: [[0, 2], [5, 4], [1], ["1", "2"], [1.5, 2], "x"],
        notArray: "nope",
      }),
    ).toEqual({ ok: [[1, 3]] }); // adjacent ranges merge; keys with no valid range are dropped
    expect(parseChangedRanges([])).toEqual({});
    expect(parseChangedRanges("x")).toEqual({});
  });
});
