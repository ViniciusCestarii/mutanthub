import type { DriftStatus } from "@/generated/prisma/enums";
import type { AppliesResult } from "@/domain/kill-claims/applies";

export const DRIFT_STATUSES: DriftStatus[] = ["UNCHECKED", "APPLIES", "MOVED", "GONE"];

export const DRIFT_STATUS_LABEL: Record<DriftStatus, string> = {
  UNCHECKED: "Not checked",
  APPLIES: "Still applies",
  MOVED: "Moved",
  GONE: "Gone",
};

/** Maps a code lookup at the default branch to the stored drift status. */
export function classifyDrift(location: AppliesResult): {
  status: DriftStatus;
  line: number | null;
} {
  switch (location.applies) {
    case "APPLIES":
      return { status: "APPLIES", line: location.line };
    case "MOVED":
      return { status: "MOVED", line: location.line };
    default:
      return { status: "GONE", line: null };
  }
}

/** Only these mutants are worth re-checking: still open and not settled. */
export const DRIFT_REVIEW_STATUSES = ["PENDING", "NEEDS_INFORMATION", "APPROVED"] as const;
export const DRIFT_MUTATION_STATUSES = ["UNKNOWN", "SURVIVED"] as const;
