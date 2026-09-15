import { z } from "zod";
import { LIMITS } from "@/lib/validation/limits";
import {
  commitShaSchema,
  filePathSchema,
  mutationOperatorSchema,
  observedResultSchema,
} from "@/lib/validation/schemas";
import { generateTitle } from "@/domain/mutants/title";

/** Caps for one uploaded file. */
export const IMPORT_MAX_ROWS = 2000;
export const IMPORT_MAX_BYTES = 20 * 1024 * 1024;

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : undefined));

const optionalNumber = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (v === null || v === undefined || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  })
  .refine((v) => v === undefined || (Number.isInteger(v) && v >= 0), "Must be a whole number");

export const importToolSchema = z.object({
  name: optional(100),
  version: optional(60),
  /** The tool's own identifier for the mutant, kept for traceability. */
  mutantId: optional(200),
});

/** Batch-level defaults that rows may omit (test command, environment, ...). */
export const importDefaultsSchema = z.object({
  commit: commitShaSchema.optional(),
  buildCommand: optional(LIMITS.command),
  testCommand: optional(LIMITS.command),
  fuzzCommand: optional(LIMITS.command),
  environment: optional(LIMITS.environment),
  testDurationSeconds: optionalNumber,
  observedResult: observedResultSchema.optional(),
  mutationOperator: mutationOperatorSchema.optional(),
});

/** One mutant as produced by a tool; field names match the dataset export. */
export const importRowSchema = z
  .object({
    commit: commitShaSchema.optional(),
    file: filePathSchema,
    startLine: z.coerce.number().int().min(1),
    endLine: z.coerce.number().int().min(1).optional(),
    originalCode: z.string().min(1, "originalCode is required").max(LIMITS.code),
    mutatedCode: z.string().min(1, "mutatedCode is required").max(LIMITS.code),
    diff: optional(LIMITS.diff),
    mutationOperator: mutationOperatorSchema.optional(),
    title: optional(LIMITS.title),
    description: optional(LIMITS.description),
    observedResult: observedResultSchema.optional(),
    buildCommand: optional(LIMITS.command),
    testCommand: optional(LIMITS.command),
    fuzzCommand: optional(LIMITS.command),
    environment: optional(LIMITS.environment),
    testDurationSeconds: optionalNumber,
    notes: optional(LIMITS.notes),
    tool: importToolSchema.optional(),
    externalId: optional(200),
  })
  .refine((r) => (r.endLine ?? r.startLine) >= r.startLine, {
    message: "endLine must be greater than or equal to startLine",
    path: ["endLine"],
  })
  .refine((r) => r.originalCode.trim() !== r.mutatedCode.trim(), {
    message: "mutatedCode must differ from originalCode",
    path: ["mutatedCode"],
  });

export type ImportRowInput = z.infer<typeof importRowSchema>;
export type ImportDefaults = Partial<z.infer<typeof importDefaultsSchema>>;

/** A row after defaults were applied and required values resolved. */
export interface ImportRow {
  index: number;
  commit: string;
  file: string;
  startLine: number;
  endLine: number;
  originalCode: string;
  mutatedCode: string;
  diff: string | null;
  mutationOperator: z.infer<typeof mutationOperatorSchema>;
  title: string;
  description: string | null;
  observedResult: z.infer<typeof observedResultSchema>;
  buildCommand: string | null;
  testCommand: string;
  fuzzCommand: string | null;
  environment: string | null;
  testDurationSeconds: number | null;
  notes: string | null;
  externalId: string | null;
}

export interface RowIssue {
  index: number;
  message: string;
  /** For duplicates: the id of the mutant that already exists. */
  existingId?: number;
}

/** Applies batch defaults and produces a complete row, or the first validation problem. */
export function prepareRow(
  raw: unknown,
  index: number,
  defaults: ImportDefaults,
  tool: { name?: string; version?: string },
): { ok: true; row: ImportRow } | { ok: false; issue: RowIssue } {
  const parsed = importRowSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path?.length ? `${issue.path.join(".")}: ` : "";
    return { ok: false, issue: { index, message: `${field}${issue?.message ?? "invalid row"}` } };
  }
  const r = parsed.data;
  const commit = r.commit ?? defaults.commit;
  if (!commit)
    return {
      ok: false,
      issue: { index, message: "commit: missing (set it on the row or in defaults)" },
    };
  const testCommand = r.testCommand ?? defaults.testCommand;
  if (!testCommand)
    return {
      ok: false,
      issue: { index, message: "testCommand: missing (set it on the row or in defaults)" },
    };
  const environment = r.environment ?? defaults.environment ?? null;
  const observedResult = r.observedResult ?? defaults.observedResult;
  if (!observedResult)
    return {
      ok: false,
      issue: { index, message: "observedResult: missing (SURVIVED, KILLED or UNKNOWN)" },
    };
  const mutationOperator = r.mutationOperator ?? defaults.mutationOperator ?? "UNKNOWN";
  const duration = r.testDurationSeconds ?? defaults.testDurationSeconds;
  if (duration !== undefined && Number.isNaN(duration)) {
    return { ok: false, issue: { index, message: "testDurationSeconds: must be a number" } };
  }
  const toolNote =
    tool.name || r.tool?.name
      ? `Imported from ${r.tool?.name ?? tool.name}${(r.tool?.version ?? tool.version) ? ` ${r.tool?.version ?? tool.version}` : ""}.`
      : null;
  const row: ImportRow = {
    index,
    commit: commit.toLowerCase(),
    file: r.file,
    startLine: r.startLine,
    endLine: r.endLine ?? r.startLine,
    originalCode: r.originalCode,
    mutatedCode: r.mutatedCode,
    diff: r.diff ?? null,
    mutationOperator,
    title: r.title ?? generateTitle({ mutationOperator, filePath: r.file, startLine: r.startLine }),
    description: r.description ?? null,
    observedResult,
    buildCommand: r.buildCommand ?? defaults.buildCommand ?? null,
    testCommand,
    fuzzCommand: r.fuzzCommand ?? defaults.fuzzCommand ?? null,
    environment,
    testDurationSeconds: duration ?? null,
    notes: [r.notes, toolNote].filter(Boolean).join("\n") || null,
    externalId: r.externalId ?? r.tool?.mutantId ?? null,
  };
  return { ok: true, row };
}
