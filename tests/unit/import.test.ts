import { describe, expect, it } from "vitest";
import { ImportParseError, parseImportFile } from "@/domain/import/parse";
import {
  IMPORT_MAX_ROWS,
  prepareRow,
  IMPORT_MAX_BYTES,
  type ImportDefaults,
} from "@/domain/import/schema";
import { generateTitle } from "@/domain/mutants/title";

const COMMIT = "e8d1c4b7a2f5e8d1c4b7a2f5e8d1c4b7a2f5e8d1";
const row = {
  file: "lib/escape.c",
  startLine: 87,
  originalCode: "  alloc = length * 3 + 1;",
  mutatedCode: "  alloc = length * 3;",
};
const defaults = {
  commit: COMMIT,
  testCommand: "make test",
  environment: "ubuntu",
  observedResult: "SURVIVED" as const,
};

describe("parseImportFile", () => {
  it("accepts a bare JSON array", () => {
    const parsed = parseImportFile(JSON.stringify([row, row]));
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.tool).toEqual({});
  });

  it("accepts an envelope with tool and defaults", () => {
    const parsed = parseImportFile(
      JSON.stringify({ tool: { name: "mull", version: "0.24" }, defaults, mutants: [row] }),
    );
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.tool).toEqual({ name: "mull", version: "0.24", mutantId: undefined });
    expect(parsed.defaults.commit).toBe(COMMIT);
  });

  it("accepts JSON Lines with an optional header line", () => {
    const text = [
      JSON.stringify({ tool: { name: "universalmutator" }, defaults }),
      JSON.stringify(row),
      "",
      JSON.stringify(row),
    ].join("\n");
    const parsed = parseImportFile(text);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.tool.name).toBe("universalmutator");
    expect(parsed.defaults.testCommand).toBe("make test");
  });

  it("rejects empty, malformed and oversized input", () => {
    expect(() => parseImportFile("   ")).toThrow(ImportParseError);
    expect(() => parseImportFile("[1,")).toThrow(/Invalid JSON/);
    expect(() => parseImportFile('{"foo": 1}')).toThrow(/mutants/);
    expect(() => parseImportFile("[]")).toThrow(/No mutants/);
    expect(() => parseImportFile('{"a":1}\nnot json')).toThrow(/Line 2/);
    const many = JSON.stringify(Array.from({ length: IMPORT_MAX_ROWS + 1 }, () => row));
    expect(() => parseImportFile(many)).toThrow(/Too many rows/);
  });
});

describe("prepareRow", () => {
  it("applies defaults and generates a title", () => {
    const result = prepareRow(row, 0, defaults, { name: "mull", version: "0.24" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row).toMatchObject({
      commit: COMMIT,
      endLine: 87,
      mutationOperator: "UNKNOWN",
      testCommand: "make test",
      environment: "ubuntu",
      observedResult: "SURVIVED",
      title: "Unknown mutation at escape.c:87",
      notes: "Imported from mull 0.24.",
      externalId: null,
    });
  });

  it("lets row values win over defaults and keeps the tool's mutant id", () => {
    const result = prepareRow(
      {
        ...row,
        commit: COMMIT.toUpperCase(),
        mutationOperator: "ARITHMETIC_OPERATOR",
        title: "Drop the +1",
        observedResult: "KILLED",
        tool: { mutantId: "m-42" },
        testDurationSeconds: "12",
      },
      3,
      defaults,
      {},
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.commit).toBe(COMMIT);
    expect(result.row.title).toBe("Drop the +1");
    expect(result.row.observedResult).toBe("KILLED");
    expect(result.row.externalId).toBe("m-42");
    expect(result.row.testDurationSeconds).toBe(12);
    expect(result.row.notes).toBeNull();
  });

  it("reports the first problem with its field and row index", () => {
    const missingCommit = prepareRow(row, 5, { ...defaults, commit: undefined }, {});
    expect(missingCommit).toEqual({
      ok: false,
      issue: { index: 5, message: expect.stringMatching(/^commit: missing/) },
    });
    const badLine = prepareRow({ ...row, startLine: 0 }, 1, defaults, {});
    expect(badLine.ok).toBe(false);
    if (!badLine.ok) expect(badLine.issue.message).toMatch(/^startLine:/);
    const same = prepareRow({ ...row, mutatedCode: row.originalCode }, 2, defaults, {});
    if (!same.ok) expect(same.issue.message).toMatch(/must differ/);
    const traversal = prepareRow({ ...row, file: "../etc/passwd" }, 2, defaults, {});
    expect(traversal.ok).toBe(false);
    const noResult = prepareRow(row, 0, { ...defaults, observedResult: undefined }, {});
    if (!noResult.ok) expect(noResult.issue.message).toMatch(/observedResult/);
  });

  it("accepts a row without mutatedCode as a deletion", () => {
    const result = prepareRow({ ...row, mutatedCode: "" }, 0, defaults, {});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.row.mutatedCode).toBe("");
    const absent = prepareRow(
      { file: row.file, startLine: 87, originalCode: row.originalCode },
      1,
      defaults,
      {},
    );
    expect(absent.ok).toBe(true);
  });

  it("generates titles from the operator and file name", () => {
    expect(
      generateTitle({
        mutationOperator: "RELATIONAL_OPERATOR",
        filePath: "src/a/b.c",
        startLine: 9,
      }),
    ).toBe("Relational operator mutation at b.c:9");
  });
});

// Added from the mutation-testing report: kills mutants that survived the original tests.
describe("import parsing edge cases", () => {
  const row = {
    file: "lib/escape.c",
    startLine: 87,
    originalCode: "  alloc = length * 3 + 1;",
    mutatedCode: "  alloc = length * 3;",
  };
  const defaults: ImportDefaults = {
    commit: "e8d1c4b7a2f5e8d1c4b7a2f5e8d1c4b7a2f5e8d1",
    testCommand: "make test",
    observedResult: "SURVIVED",
  };

  it("enforces the size and row limits exactly", () => {
    const rows = Array.from({ length: IMPORT_MAX_ROWS }, () => row);
    expect(parseImportFile(JSON.stringify(rows)).rows).toHaveLength(IMPORT_MAX_ROWS);
    const padding = " ".repeat(IMPORT_MAX_BYTES - 2);
    expect(() => parseImportFile(`[]${padding}`)).toThrow(/No mutants/); // exactly at the limit
    expect(() => parseImportFile(`[]${padding} `)).toThrow(/larger than 20 MB/);
    const error = (() => {
      try {
        parseImportFile("");
      } catch (e) {
        return e as Error;
      }
      return null;
    })();
    expect(error).toBeInstanceOf(ImportParseError);
    expect(error?.name).toBe("ImportParseError");
  });

  it("distinguishes envelopes, JSON Lines headers and plain rows", () => {
    expect(() => parseImportFile('{"tool": {"name": "x"}}')).toThrow(/mutants/);
    expect(() => parseImportFile("[{}]")).not.toThrow();
    // A header-looking line after the first row is just an invalid row, not a header.
    const late = [JSON.stringify(row), JSON.stringify({ tool: { name: "late" } })].join("\n");
    const parsed = parseImportFile(late);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.tool).toEqual({});
    // A row that carries a "file" key is never mistaken for a header.
    const withFile = JSON.stringify({ tool: { name: "t" }, ...row });
    expect(parseImportFile(`${withFile}\n${JSON.stringify(row)}`).rows).toHaveLength(2);
    // A single row object on its own is one mutant, not a broken envelope.
    expect(parseImportFile(`  ${JSON.stringify(row)}  \n\n`).rows).toHaveLength(1);
  });

  it("validates numbers, line order and defaults precedence per row", () => {
    const issue = (raw: unknown, d = defaults) => {
      const r = prepareRow(raw, 3, d, {});
      return r.ok ? null : r.issue.message;
    };
    expect(issue({ ...row, testDurationSeconds: "abc" })).toMatch(/testDurationSeconds/);
    expect(issue({ ...row, testDurationSeconds: -1 })).toMatch(/testDurationSeconds/);
    expect(issue({ ...row, testDurationSeconds: 1.5 })).toMatch(/whole number/);
    expect(issue({ ...row, testDurationSeconds: "" })).toBeNull();
    expect(issue({ ...row, endLine: 86 })).toMatch(/^endLine: /);
    expect(issue({ ...row, mutatedCode: `${row.originalCode}  ` })).toMatch(
      /mutatedCode: .*differ/,
    );
    expect(issue({ ...row, startLine: "x" })).toMatch(/^startLine: /);
    expect(issue(row, { ...defaults, testCommand: undefined })).toMatch(/^testCommand: missing/);
    expect(issue(row, { ...defaults, observedResult: undefined })).toMatch(
      /^observedResult: missing/,
    );
    expect(issue(row, { ...defaults, testDurationSeconds: NaN })).toMatch(
      /testDurationSeconds: must be a number/,
    );

    const merged = prepareRow(
      { ...row, buildCommand: "row-build", diff: "--- a\n+++ b", description: "d", notes: "n" },
      0,
      {
        ...defaults,
        buildCommand: "default-build",
        fuzzCommand: "default-fuzz",
        mutationOperator: "RETURN_VALUE",
      },
      { name: "mull" },
    );
    expect(merged.ok).toBe(true);
    if (merged.ok) {
      expect(merged.row.buildCommand).toBe("row-build");
      expect(merged.row.fuzzCommand).toBe("default-fuzz");
      expect(merged.row.diff).toBe("--- a\n+++ b");
      expect(merged.row.description).toBe("d");
      expect(merged.row.mutationOperator).toBe("RETURN_VALUE");
      expect(merged.row.notes).toBe("n\nImported from mull.");
      expect(merged.row.environment).toBeNull();
    }
    const bare = prepareRow(row, 0, defaults, {});
    if (bare.ok) {
      expect(bare.row.notes).toBeNull();
      expect(bare.row.buildCommand).toBeNull();
      expect(bare.row.diff).toBeNull();
    }
  });
});
