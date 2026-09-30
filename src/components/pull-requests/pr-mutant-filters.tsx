import Link from "next/link";
import { Filter, X } from "lucide-react";
import type { PullRequestMutantFilter } from "@/lib/validation/schemas";
import { Button } from "@/components/ui/button";
import {
  FilterField,
  FilterSelect,
  MUTATION_STATUS_OPTIONS,
  REVIEW_STATUS_OPTIONS,
} from "@/components/mutants/mutant-filters";

const SUPERSEDED_OPTIONS = [
  { value: "show", label: "Show" },
  { value: "only", label: "Only superseded" },
];

/** GET form over the pull request page; filters apply to both mutant sections. */
export function PullRequestMutantFilters({
  action,
  values,
  filePaths,
}: {
  action: string;
  values: PullRequestMutantFilter;
  filePaths: string[];
}) {
  const active = Object.values(values).filter(Boolean).length;
  return (
    // Keyed on the values: stat tiles and file links navigate client-side, and the
    // uncontrolled selects would otherwise keep showing the previous filters.
    <form
      key={JSON.stringify(values)}
      method="get"
      action={action}
      className="border-border bg-card rounded-lg border p-3"
      data-testid="pr-mutant-filters"
    >
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <FilterField label="Outcome">
          <FilterSelect
            name="mutationStatus"
            value={values.mutationStatus}
            options={MUTATION_STATUS_OPTIONS}
            testId="pr-filter-mutation-status"
          />
        </FilterField>
        <FilterField label="Review">
          <FilterSelect
            name="reviewStatus"
            value={values.reviewStatus}
            options={REVIEW_STATUS_OPTIONS}
            testId="pr-filter-review-status"
          />
        </FilterField>
        <FilterField label="File">
          <FilterSelect
            name="file"
            value={values.file}
            options={filePaths.map((p) => ({ value: p, label: p }))}
            placeholder="All files"
            testId="pr-filter-file"
          />
        </FilterField>
        <FilterField label="Superseded">
          <FilterSelect
            name="superseded"
            value={values.superseded}
            options={SUPERSEDED_OPTIONS}
            placeholder="Hide (latest only)"
            testId="pr-filter-superseded"
          />
        </FilterField>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs">
          {active
            ? `${active} filter${active === 1 ? "" : "s"} active`
            : "Latest result per mutation"}
        </span>
        <div className="flex gap-1.5">
          {active ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={action}>
                <X className="size-3.5" aria-hidden /> Clear
              </Link>
            </Button>
          ) : null}
          <Button type="submit" size="sm" variant="secondary" data-testid="pr-filter-apply">
            <Filter className="size-3.5" aria-hidden /> Apply
          </Button>
        </div>
      </div>
    </form>
  );
}
