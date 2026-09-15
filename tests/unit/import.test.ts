import { describe, expect, it } from "vitest";
import { ImportParseError, parseImportFile } from "@/domain/import/parse";
import { generateTitle, IMPORT_MAX_ROWS, prepareRow } from "@/domain/import/schema";

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

  it("generates titles from the operator and file name", () => {
    expect(
      generateTitle({ mutationOperator: "RELATIONAL_OPERATOR", file: "src/a/b.c", startLine: 9 }),
    ).toBe("Relational operator mutation at b.c:9");
  });
});
