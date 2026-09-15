import type { MutationOperator } from "@/generated/prisma/enums";
import { LIMITS } from "@/lib/validation/limits";
import { operatorLabel } from "./operators";

/**
 * Title used when the submitter (or an imported row) leaves it empty:
 * "Relational operator mutation at escape.c:164".
 */
export function generateTitle(input: {
  mutationOperator: MutationOperator;
  filePath: string;
  startLine: number;
}): string {
  const name = input.filePath.split("/").pop() || input.filePath;
  return `${operatorLabel(input.mutationOperator)} mutation at ${name}:${input.startLine}`.slice(
    0,
    LIMITS.title,
  );
}
