import type { MutationStatus, ReviewStatus } from "@/generated/prisma/enums";
import { mutantTouchesDiff, type ChangedRanges } from "./diff-ranges";

/** Minimal mutant shape needed for the check-run summary. */
export interface CheckMutant {
  id: number;
  title: string;
  filePath: string;
  startLine: number;
  endLine: number;
  reviewStatus: ReviewStatus;
  mutationStatus: MutationStatus;
  /** Number of reproductions recorded. */
  validations: number;
  /** Commit the mutant was recorded against. */
  commitSha: string;
}

export interface CheckSummary {
  /** GitHub check conclusion: never blocks a merge. */
  conclusion: "neutral" | "success";
  title: string;
  /** Markdown body shown on the check page. */
  text: string;
  counts: {
    onDiff: number;
    surviving: number;
    killed: number;
    equivalent: number;
    pendingReview: number;
    offDiff: number;
    olderHead: number;
  };
}

const ACTIVE_REVIEW: ReviewStatus[] = ["PENDING", "NEEDS_INFORMATION", "APPROVED"];

/**
 * Summarises the mutants of a pull request for a GitHub check run.
 * Only mutants on lines the PR changed count towards the headline; the rest
 * are listed as context. Wording never treats a surviving mutant as a defect.
 */
export function buildCheckSummary(
  pr: { number: number; headSha: string },
  mutants: CheckMutant[],
  changed: ChangedRanges,
  baseUrl: string,
): CheckSummary {
  const relevant = mutants.filter((m) => ACTIVE_REVIEW.includes(m.reviewStatus));
  const onDiff = relevant.filter((m) => mutantTouchesDiff(m, changed));
  const offDiff = relevant.length - onDiff.length;
  const olderHead = onDiff.filter((m) => m.commitSha !== pr.headSha).length;
  const counts = {
    onDiff: onDiff.length,
    surviving: onDiff.filter((m) => m.mutationStatus === "SURVIVED").length,
    killed: onDiff.filter((m) => m.mutationStatus === "KILLED").length,
    equivalent: onDiff.filter((m) => m.mutationStatus === "EQUIVALENT").length,
    pendingReview: onDiff.filter((m) => m.reviewStatus !== "APPROVED").length,
    offDiff,
    olderHead,
  };

  const title =
    counts.onDiff === 0
      ? "No mutants recorded on the changed lines yet"
      : `${counts.surviving} surviving, ${counts.killed} killed, ${counts.equivalent} equivalent on changed lines`;

  const lines: string[] = [];
  lines.push(
    `MutantHub tracks mutants that contributors tested against this pull request. ` +
      `A surviving mutant means the recorded tests did not detect it; it may still be equivalent, ` +
      `environment-dependent, or simply not reproduced yet.`,
  );
  lines.push("");
  if (onDiff.length === 0) {
    lines.push(
      `No mutants on the changed lines. [Suggest one](${baseUrl}/projects) from the code browser.`,
    );
  } else {
    lines.push("| Mutant | File | Outcome | Review | Reproductions |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const m of onDiff.slice(0, 50)) {
      const drift = m.commitSha !== pr.headSha ? " (earlier head)" : "";
      lines.push(
        `| [#${m.id}](${baseUrl}/mutants/${m.id}) ${escapePipes(m.title)} | \`${m.filePath}:${m.startLine}\`${drift} | ${m.mutationStatus} | ${m.reviewStatus} | ${m.validations} |`,
      );
    }
    if (onDiff.length > 50) lines.push(`| ... | ${onDiff.length - 50} more | | | |`);
  }
  if (offDiff > 0) {
    lines.push("");
    lines.push(
      `${offDiff} more mutant${offDiff === 1 ? "" : "s"} recorded on this pull request outside the changed lines.`,
    );
  }
  if (olderHead > 0) {
    lines.push("");
    lines.push(
      `${olderHead} of the listed mutants refer to an earlier head of this pull request; line numbers may have moved.`,
    );
  }

  return {
    conclusion: counts.onDiff === 0 ? "success" : "neutral",
    title,
    text: lines.join("\n"),
    counts,
  };
}

function escapePipes(text: string): string {
  return text.replace(/\|/g, "\\|");
}
