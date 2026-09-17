import { z } from "zod";
import {
  importDefaultsSchema,
  importToolSchema,
  IMPORT_MAX_BYTES,
  IMPORT_MAX_ROWS,
} from "./schema";

export interface ParsedImportFile {
  rows: unknown[];
  tool: { name?: string; version?: string };
  defaults: Partial<z.infer<typeof importDefaultsSchema>>;
}

export class ImportParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportParseError";
  }
}

const envelopeSchema = z.object({
  tool: importToolSchema.optional(),
  defaults: importDefaultsSchema.optional(),
  mutants: z.array(z.unknown()),
});

/**
 * Accepts three shapes: a JSON array of rows, an object
 * `{ tool, defaults, mutants: [...] }`, or JSON Lines (one row per line,
 * optionally preceded by a `{ "tool": ..., "defaults": ... }` header line).
 */
export function parseImportFile(text: string): ParsedImportFile {
  if (Buffer.byteLength(text, "utf8") > IMPORT_MAX_BYTES) {
    throw new ImportParseError(`File is larger than ${IMPORT_MAX_BYTES / (1024 * 1024)} MB`);
  }
  const trimmed = text.trim();
  if (!trimmed) throw new ImportParseError("The file is empty");

  let parsed: ParsedImportFile;
  if (trimmed.startsWith("[")) {
    parsed = { rows: parseJson(trimmed, "array") as unknown[], tool: {}, defaults: {} };
  } else if (trimmed.startsWith("{") && looksLikeSingleObject(trimmed)) {
    const value = parseJson(trimmed, "object");
    const envelope = envelopeSchema.safeParse(value);
    if (envelope.success) {
      parsed = {
        rows: envelope.data.mutants,
        tool: envelope.data.tool ?? {},
        defaults: envelope.data.defaults ?? {},
      };
    } else if (typeof value === "object" && value !== null && "file" in value) {
      // A single row on its own (one-line JSON Lines file).
      parsed = { rows: [value], tool: {}, defaults: {} };
    } else {
      throw new ImportParseError('Expected { "tool"?, "defaults"?, "mutants": [...] }');
    }
  } else {
    parsed = parseJsonLines(trimmed);
  }
  if (parsed.rows.length === 0) throw new ImportParseError("No mutants found in the file");
  if (parsed.rows.length > IMPORT_MAX_ROWS) {
    throw new ImportParseError(
      `Too many rows (${parsed.rows.length}); the limit is ${IMPORT_MAX_ROWS} per file`,
    );
  }
  return parsed;
}

function parseJson(text: string, expected: "array" | "object"): unknown {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new ImportParseError(`Invalid JSON: ${(error as Error).message}`);
  }
  if (expected === "array" && !Array.isArray(value))
    throw new ImportParseError("Expected a JSON array");
  if (
    expected === "object" &&
    (typeof value !== "object" || value === null || Array.isArray(value))
  ) {
    throw new ImportParseError("Expected a JSON object");
  }
  return value;
}

/** A single JSON object spans the whole text; JSON Lines has one object per line. */
function looksLikeSingleObject(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

function parseJsonLines(text: string): ParsedImportFile {
  const rows: unknown[] = [];
  let tool: ParsedImportFile["tool"] = {};
  let defaults: ParsedImportFile["defaults"] = {};
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch (error) {
      throw new ImportParseError(`Line ${i + 1}: invalid JSON (${(error as Error).message})`);
    }
    if (rows.length === 0 && isHeader(value)) {
      const header = envelopeSchema.omit({ mutants: true }).safeParse(value);
      if (header.success) {
        tool = header.data.tool ?? {};
        defaults = header.data.defaults ?? {};
        continue;
      }
    }
    rows.push(value);
  }
  return { rows, tool, defaults };
}

function isHeader(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !("file" in value) &&
    ("tool" in value || "defaults" in value)
  );
}
