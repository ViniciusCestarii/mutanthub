import { describe, expect, it } from "vitest";
import { csvEscape, csvHeader, csvLine, rowToCsv } from "@/domain/dataset/csv";
import { EXPORT_COLUMNS, type ExportRow } from "@/domain/dataset/export-row";
import { hashRows, snapshotSlug } from "@/domain/dataset/hash";

const row: ExportRow = {
  id: 7,
  repository: "curl/curl",
  language: "C",
  commit: "abc",
  pullRequest: null,
  file: "lib/url.c",
  startLine: 117,
  endLine: 117,
  title: 'Port "65535" is rejected',
  description: null,
  mutationOperator: "RELATIONAL_OPERATOR",
  originalCode: "if(value > MAX_PORT)",
  mutatedCode: "if(value >= MAX_PORT)",
  diff: "--- a/lib/url.c\n+++ b/lib/url.c\n-old\n+new\n",
  reviewStatus: "APPROVED",
  mutationStatus: "SURVIVED",
  observedResult: "SURVIVED",
  buildCommand: "=cmd()",
  testCommand: "make test-ci",
  fuzzCommand: null,
  environment: "Ubuntu 24.04, gcc 14",
  reproductions: 3,
  reproducedSurvived: 3,
  reproducedKilled: 0,
  reproducedCouldNotReproduce: 0,
  killingTestRefs: null,
  contributor: "frank",
  createdAt: "2026-09-01T10:00:00.000Z",
  updatedAt: "2026-09-02T10:00:00.000Z",
  url: "https://mh.test/mutants/7",
};

describe("CSV writer", () => {
  it("quotes fields with separators, quotes and line breaks", () => {
    expect(csvEscape("plain")).toBe("plain");
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(42)).toBe("42");
  });

  it("neutralises spreadsheet formula injection without touching diffs", () => {
    expect(csvEscape("=cmd()")).toBe("'=cmd()");
    expect(csvEscape("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvEscape("+1")).toBe("+1");
    expect(csvEscape("-a > b")).toBe("-a > b");
  });

  it("emits a header in the documented column order and CRLF rows", () => {
    expect(csvHeader()).toBe(`${EXPORT_COLUMNS.join(",")}\r\n`);
    expect(csvLine(["a", "b"])).toBe("a,b\r\n");
    const line = rowToCsv(row);
    expect(line.endsWith("\r\n")).toBe(true);
    expect(line.startsWith("7,curl/curl,C,abc,,lib/url.c,117,117,")).toBe(true);
    expect(line).toContain('"--- a/lib/url.c\n+++ b/lib/url.c\n-old\n+new\n"');
    expect(line).toContain("'=cmd()");
  });
});

describe("snapshot hashing", () => {
  it("is deterministic and independent of row order or key order", () => {
    const other: ExportRow = { ...row, id: 8, title: "Second" };
    const a = hashRows([row, other]);
    const b = hashRows([other, row]);
    const shuffled = JSON.parse(JSON.stringify({ ...row, url: row.url, id: row.id })) as ExportRow;
    expect(a).toBe(b);
    expect(hashRows([shuffled, other])).toBe(a);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes when any field changes", () => {
    expect(hashRows([row])).not.toBe(hashRows([{ ...row, mutationStatus: "KILLED" }]));
  });

  it("builds URL-safe slugs with the date", () => {
    expect(snapshotSlug("Surviving mutants, Sept 2026!", new Date("2026-09-15T12:00:00Z"))).toBe(
      "surviving-mutants-sept-2026-2026-09-15",
    );
    expect(snapshotSlug("###", new Date("2026-09-15T12:00:00Z"))).toBe("snapshot-2026-09-15");
  });
});
