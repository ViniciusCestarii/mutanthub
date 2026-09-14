import type { ValidationResult } from "@/generated/prisma/enums";

export interface ValidationCounts {
  survived: number;
  killed: number;
  couldNotReproduce: number;
  total: number;
}

export type ValidationConsensus =
  "NONE" | "SURVIVED" | "KILLED" | "COULD_NOT_REPRODUCE" | "CONFLICTING";

export interface ValidationSummary extends ValidationCounts {
  consensus: ValidationConsensus;
  label: string;
}

export function countValidations(results: ValidationResult[]): ValidationCounts {
  const counts: ValidationCounts = { survived: 0, killed: 0, couldNotReproduce: 0, total: 0 };
  for (const r of results) {
    counts.total += 1;
    if (r === "SURVIVED") counts.survived += 1;
    else if (r === "KILLED") counts.killed += 1;
    else counts.couldNotReproduce += 1;
  }
  return counts;
}

function contributors(n: number): string {
  return `${n} contributor${n === 1 ? "" : "s"}`;
}

/**
 * Summarizes reproduction attempts. "Confirmed" only when every reported
 * outcome agrees; a single disagreement is surfaced as conflicting so that the
 * community investigates instead of trusting a majority blindly.
 */
export function summarizeValidations(results: ValidationResult[]): ValidationSummary {
  const counts = countValidations(results);
  if (counts.total === 0) {
    return { ...counts, consensus: "NONE", label: "Not reproduced yet" };
  }
  const outcomes = [counts.survived > 0, counts.killed > 0].filter(Boolean).length;
  if (outcomes > 1) {
    return { ...counts, consensus: "CONFLICTING", label: "Conflicting results" };
  }
  const cnr =
    counts.couldNotReproduce > 0 ? `, ${counts.couldNotReproduce} could not reproduce` : "";
  if (counts.survived > 0) {
    return {
      ...counts,
      consensus: "SURVIVED",
      label: `Survived — confirmed by ${contributors(counts.survived)}${cnr}`,
    };
  }
  if (counts.killed > 0) {
    return {
      ...counts,
      consensus: "KILLED",
      label: `Killed — reported by ${contributors(counts.killed)}${cnr}`,
    };
  }
  return {
    ...counts,
    consensus: "COULD_NOT_REPRODUCE",
    label: `Could not reproduce — ${contributors(counts.couldNotReproduce)}`,
  };
}
