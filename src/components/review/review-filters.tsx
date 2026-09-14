import Link from "next/link";
import { Filter, X } from "lucide-react";
import type { ReviewQueueFilter } from "@/lib/validation/schemas";
import {
  FilterField,
  FilterInput,
  FilterSelect,
  OPERATOR_OPTIONS,
  REVIEW_STATUS_OPTIONS,
  type FilterOption,
} from "@/components/mutants/mutant-filters";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

interface ReviewFiltersProps {
  filter: ReviewQueueFilter;
  projects: FilterOption[];
}

export function ReviewFilters({ filter, projects }: ReviewFiltersProps) {
  const active = [
    filter.project,
    filter.contributor,
    filter.file,
    filter.status,
    filter.operator,
    filter.since,
    filter.duplicates,
  ].filter(Boolean).length;
  return (
    <form
      method="get"
      action={routes.review()}
      className="border-border bg-card rounded-lg border p-3"
      data-testid="review-filters"
    >
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
        <FilterField label="Project">
          <FilterSelect
            name="project"
            value={filter.project}
            options={projects}
            placeholder="All projects"
            testId="review-filter-project"
          />
        </FilterField>
        <FilterField label="Contributor">
          <FilterInput
            name="contributor"
            value={filter.contributor}
            placeholder="username"
            mono
            testId="review-filter-contributor"
          />
        </FilterField>
        <FilterField label="File">
          <FilterInput
            name="file"
            value={filter.file}
            placeholder="path contains"
            mono
            testId="review-filter-file"
          />
        </FilterField>
        <FilterField label="Status">
          <FilterSelect
            name="status"
            value={filter.status}
            options={REVIEW_STATUS_OPTIONS}
            placeholder="Pending + needs info"
            testId="review-filter-status"
          />
        </FilterField>
        <FilterField label="Operator">
          <FilterSelect
            name="operator"
            value={filter.operator}
            options={OPERATOR_OPTIONS}
            testId="review-filter-operator"
          />
        </FilterField>
        <FilterField label="Submitted since">
          <FilterInput name="since" value={filter.since} type="date" testId="review-filter-since" />
        </FilterField>
        <FilterField label="Duplicates">
          <FilterSelect
            name="duplicates"
            value={filter.duplicates}
            options={[
              { value: "only", label: "Only possible duplicates" },
              { value: "hide", label: "Hide possible duplicates" },
            ]}
            placeholder="All"
            testId="review-filter-duplicates"
          />
        </FilterField>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs">
          {active
            ? `${active} filter${active === 1 ? "" : "s"} active`
            : "Showing pending and needs-information submissions"}
        </span>
        <div className="flex gap-1.5">
          {active ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={routes.review()}>
                <X className="size-3.5" aria-hidden /> Clear
              </Link>
            </Button>
          ) : null}
          <Button type="submit" size="sm" variant="secondary" data-testid="review-filter-apply">
            <Filter className="size-3.5" aria-hidden /> Apply
          </Button>
        </div>
      </div>
    </form>
  );
}
