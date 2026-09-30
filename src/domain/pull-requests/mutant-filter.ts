import type { MutationStatus, ReviewStatus } from "@/generated/prisma/enums";
import type { PullRequestMutantFilter } from "@/lib/validation/schemas";

interface FilterableMutant {
  filePath: string;
  reviewStatus: ReviewStatus;
  mutationStatus: MutationStatus;
  superseded: boolean;
}

/** Applies the pull request page filters; superseded mutants are hidden unless asked for. */
export function filterPullRequestMutants<T extends FilterableMutant>(
  mutants: T[],
  filter: PullRequestMutantFilter,
): T[] {
  return mutants.filter(
    (m) =>
      (filter.superseded === "show" || m.superseded === (filter.superseded === "only")) &&
      (!filter.mutationStatus || m.mutationStatus === filter.mutationStatus) &&
      (!filter.reviewStatus || m.reviewStatus === filter.reviewStatus) &&
      (!filter.file || m.filePath === filter.file),
  );
}
