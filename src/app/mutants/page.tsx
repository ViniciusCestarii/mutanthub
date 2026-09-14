import type { Metadata } from "next";
import Link from "next/link";
import { Braces, BookOpen } from "lucide-react";
import { mutantService } from "@/server/services/mutant-service";
import { projectRepository } from "@/server/repositories/project-repository";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { MutantTable } from "@/components/mutants/mutant-table";
import {
  MutantFilters,
  buildQuery,
  type MutantFilterValues,
} from "@/components/mutants/mutant-filters";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mutants" };

type SearchParams = Record<string, string | string[] | undefined>;

function firstValues(sp: SearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    const value = Array.isArray(v) ? v[0] : v;
    if (value) out[k] = value;
  }
  return out;
}

export default async function MutantsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const raw = firstValues(await searchParams);
  const [{ items, total, filter }, projects] = await Promise.all([
    mutantService.list(raw),
    projectRepository.list({ activeOnly: true }),
  ]);

  const values: MutantFilterValues = {
    project: filter.project,
    language: filter.language,
    operator: filter.operator,
    reviewStatus: filter.reviewStatus,
    mutationStatus: filter.mutationStatus,
    contributor: filter.contributor,
    commit: filter.commit,
    file: filter.file,
    q: filter.q,
  };
  const languages = [
    ...new Set(projects.map((p) => p.language).filter((l): l is string => Boolean(l))),
  ].sort();
  const query = { ...values, pageSize: filter.pageSize !== 25 ? filter.pageSize : undefined };
  const apiHref = `/api/mutants${buildQuery({ ...query, page: filter.page })}`;

  return (
    <PageContainer wide className="space-y-4" data-testid="mutants-page">
      <PageHeader
        title="Mutants"
        description="Every catalogued mutant across registered projects. A surviving mutant may be equivalent, environment-dependent or simply not yet covered; reproduce before drawing conclusions."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <a href={apiHref} target="_blank" rel="noreferrer" data-testid="api-link">
                <Braces className="size-3.5" aria-hidden /> API
              </a>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href={routes.apiDocs()}>
                <BookOpen className="size-3.5" aria-hidden /> Docs
              </Link>
            </Button>
          </>
        }
      />
      <MutantFilters
        action={routes.mutants()}
        values={values}
        projects={projects.map((p) => ({
          value: `${p.githubOwner}/${p.githubRepository}`,
          label: `${p.githubOwner}/${p.githubRepository}`,
        }))}
        languages={languages}
      />
      <div className="text-muted-foreground text-xs" data-testid="mutant-count">
        {total} mutant{total === 1 ? "" : "s"}
      </div>
      <MutantTable
        mutants={items}
        emptyDescription="Try relaxing the filters, or browse a project's code to suggest the first mutant."
      />
      <Pagination
        page={filter.page}
        pageSize={filter.pageSize}
        total={total}
        hrefFor={(page) => `${routes.mutants()}${buildQuery({ ...query, page })}`}
      />
    </PageContainer>
  );
}
