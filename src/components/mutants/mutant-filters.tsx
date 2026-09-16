import Link from "next/link";
import { Filter, X } from "lucide-react";
import type {
  DriftStatus,
  MutationOperator,
  MutationStatus,
  ReviewStatus,
} from "@/generated/prisma/enums";
import { DRIFT_STATUSES, DRIFT_STATUS_LABEL } from "@/domain/drift/status";
import { MUTATION_OPERATORS } from "@/domain/mutants/operators";
import {
  MUTATION_STATUSES,
  MUTATION_STATUS_LABEL,
  REVIEW_STATUSES,
  REVIEW_STATUS_LABEL,
} from "@/domain/mutants/status";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------------ */
/* Primitive, JS-free filter controls (native form elements styled like     */
/* shadcn inputs). Shared by the mutant list and the review queue filters.  */
/* ------------------------------------------------------------------------ */

const CONTROL_CLASS =
  "h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export interface FilterOption {
  value: string;
  label: string;
}

export function FilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

export function FilterSelect({
  name,
  value,
  options,
  placeholder = "Any",
  testId,
}: {
  name: string;
  value?: string;
  options: FilterOption[];
  placeholder?: string;
  testId?: string;
}) {
  return (
    <select name={name} defaultValue={value ?? ""} className={CONTROL_CLASS} data-testid={testId}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function FilterInput({
  name,
  value,
  placeholder,
  type = "text",
  mono,
  testId,
}: {
  name: string;
  value?: string;
  placeholder?: string;
  type?: "text" | "date";
  mono?: boolean;
  testId?: string;
}) {
  return (
    <input
      type={type}
      name={name}
      defaultValue={value ?? ""}
      placeholder={placeholder}
      className={cn(CONTROL_CLASS, mono && "font-mono")}
      data-testid={testId}
    />
  );
}

export const OPERATOR_OPTIONS: FilterOption[] = MUTATION_OPERATORS.map((o) => ({
  value: o.value,
  label: o.label,
}));
export const REVIEW_STATUS_OPTIONS: FilterOption[] = REVIEW_STATUSES.map((s) => ({
  value: s,
  label: REVIEW_STATUS_LABEL[s],
}));
export const MUTATION_STATUS_OPTIONS: FilterOption[] = MUTATION_STATUSES.map((s) => ({
  value: s,
  label: MUTATION_STATUS_LABEL[s],
}));
export const DRIFT_STATUS_OPTIONS: FilterOption[] = DRIFT_STATUSES.map((s) => ({
  value: s,
  label: DRIFT_STATUS_LABEL[s],
}));

/** Builds a query string from a filter object, dropping empty values. */
export function buildQuery(values: Record<string, string | number | undefined | null>): string {
  const params = new URLSearchParams();
  for (const [key, v] of Object.entries(values)) {
    if (v === undefined || v === null || v === "") continue;
    params.set(key, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

/* ------------------------------------------------------------------------ */
/* Mutant list filters                                                        */
/* ------------------------------------------------------------------------ */

export interface MutantFilterValues {
  project?: string;
  language?: string;
  operator?: MutationOperator;
  reviewStatus?: ReviewStatus;
  mutationStatus?: MutationStatus;
  contributor?: string;
  commit?: string;
  file?: string;
  q?: string;
  /** Import batch id; carried as a hidden field so it survives re-filtering. */
  batch?: string;
  drift?: DriftStatus;
}

interface MutantFiltersProps {
  action: string;
  values: MutantFilterValues;
  projects: FilterOption[];
  languages: string[];
  /** When true the project select is hidden (project pages). */
  lockProject?: boolean;
}

export function MutantFilters({
  action,
  values,
  projects,
  languages,
  lockProject,
}: MutantFiltersProps) {
  const active = Object.entries(values).filter(
    ([k, v]) => v && !(lockProject && k === "project"),
  ).length;
  return (
    <form
      method="get"
      action={action}
      className="border-border bg-card rounded-lg border p-3"
      data-testid="mutant-filters"
    >
      {values.batch ? <input type="hidden" name="batch" value={values.batch} /> : null}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-9">
        {lockProject ? null : (
          <FilterField label="Project">
            <FilterSelect
              name="project"
              value={values.project}
              options={projects}
              placeholder="All projects"
              testId="filter-project"
            />
          </FilterField>
        )}
        {lockProject ? null : (
          <FilterField label="Language">
            <FilterSelect
              name="language"
              value={values.language}
              options={languages.map((l) => ({ value: l, label: l }))}
            />
          </FilterField>
        )}
        <FilterField label="Operator">
          <FilterSelect
            name="operator"
            value={values.operator}
            options={OPERATOR_OPTIONS}
            testId="filter-operator"
          />
        </FilterField>
        <FilterField label="Review">
          <FilterSelect
            name="reviewStatus"
            value={values.reviewStatus}
            options={REVIEW_STATUS_OPTIONS}
            testId="filter-review-status"
          />
        </FilterField>
        <FilterField label="Outcome">
          <FilterSelect
            name="mutationStatus"
            value={values.mutationStatus}
            options={MUTATION_STATUS_OPTIONS}
            testId="filter-mutation-status"
          />
        </FilterField>
        <FilterField label="At HEAD">
          <FilterSelect
            name="drift"
            value={values.drift}
            options={DRIFT_STATUS_OPTIONS}
            testId="filter-drift"
          />
        </FilterField>
        <FilterField label="Contributor">
          <FilterInput
            name="contributor"
            value={values.contributor}
            placeholder="username"
            mono
            testId="filter-contributor"
          />
        </FilterField>
        <FilterField label="Commit">
          <FilterInput
            name="commit"
            value={values.commit}
            placeholder="sha prefix"
            mono
            testId="filter-commit"
          />
        </FilterField>
        <FilterField label="File">
          <FilterInput
            name="file"
            value={values.file}
            placeholder="path contains"
            mono
            testId="filter-file"
          />
        </FilterField>
        <FilterField
          label="Search"
          className={lockProject ? "col-span-2 md:col-span-1 xl:col-span-3" : ""}
        >
          <FilterInput
            name="q"
            value={values.q}
            placeholder="title, code, path"
            testId="filter-q"
          />
        </FilterField>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs">
          {active ? `${active} filter${active === 1 ? "" : "s"} active` : "No filters"}
        </span>
        <div className="flex gap-1.5">
          {active ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={action}>
                <X className="size-3.5" aria-hidden /> Clear
              </Link>
            </Button>
          ) : null}
          <Button type="submit" size="sm" variant="secondary" data-testid="filter-apply">
            <Filter className="size-3.5" aria-hidden /> Apply
          </Button>
        </div>
      </div>
    </form>
  );
}
