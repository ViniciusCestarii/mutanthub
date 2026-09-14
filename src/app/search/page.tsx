import type { Metadata } from "next";
import Link from "next/link";
import { Search, SearchX } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { Section } from "@/components/shared/section";
import { EmptyState } from "@/components/shared/empty-state";
import { UserChip } from "@/components/shared/user-chip";
import { MutantTable } from "@/components/mutants/mutant-table";
import {
  MutationStatusBadge,
  OperatorBadge,
  ReviewStatusBadge,
} from "@/components/mutants/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchService } from "@/server/services/search-service";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Search" };
export const dynamic = "force-dynamic";

const HINTS: Array<[string, string]> = [
  ["repository", "curl/curl"],
  ["file path", "interpreter.cpp"],
  ["username", "@alice"],
  ["mutant id", "#12"],
  ["mutation operator", "relational operator"],
  ["status", "survived, approved"],
  ["code snippet", "nValue > MAX_MONEY"],
];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const results = query ? await searchService.search(query) : null;
  const hasResults =
    results !== null &&
    (results.mutantById !== null ||
      results.projects.length > 0 ||
      results.users.length > 0 ||
      results.mutants.length > 0);

  return (
    <PageContainer>
      <PageHeader
        title="Search"
        description="Find repositories, files, contributors and mutants."
      />

      <form
        action="/search"
        method="get"
        className="mt-5 flex gap-2"
        data-testid="search-form"
        role="search"
      >
        <Input
          name="q"
          defaultValue={query}
          placeholder="Search…"
          autoFocus
          autoComplete="off"
          aria-label="Search query"
          className="font-mono"
        />
        <Button type="submit">
          <Search className="size-4" aria-hidden /> Search
        </Button>
      </form>

      <dl className="text-muted-foreground mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {HINTS.map(([label, example]) => (
          <div key={label} className="inline-flex gap-1">
            <dt>{label}</dt>
            <dd className="text-foreground/80 font-mono">{example}</dd>
          </div>
        ))}
      </dl>

      {results ? (
        <div className="mt-6 space-y-4" data-testid="search-results">
          {results.interpretedAs.length ? (
            <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
              <span>Interpreted as</span>
              {results.interpretedAs.map((kind) => (
                <span
                  key={kind}
                  className="border-border bg-muted/50 rounded-md border px-1.5 py-0.5"
                >
                  {kind}
                </span>
              ))}
            </div>
          ) : null}

          {!hasResults ? (
            <EmptyState
              icon={SearchX}
              title={`No results for "${results.query}"`}
              description="Try a repository name, a file path, an @username or a mutant id such as #12."
            />
          ) : null}

          {results.mutantById ? (
            <Link
              href={routes.mutant(results.mutantById.id)}
              className="border-primary/30 bg-primary/5 hover:bg-primary/10 block rounded-lg border px-4 py-3"
              data-testid="search-direct-hit"
            >
              <div className="text-muted-foreground text-[11px] tracking-wide uppercase">
                Mutant
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground font-mono text-xs">
                  #{results.mutantById.id}
                </span>
                <span className="font-medium">{results.mutantById.title}</span>
                <ReviewStatusBadge status={results.mutantById.reviewStatus} />
                <MutationStatusBadge status={results.mutantById.mutationStatus} />
                <OperatorBadge operator={results.mutantById.mutationOperator} />
              </div>
              <div className="text-muted-foreground mt-1 font-mono text-xs">
                {results.mutantById.project.githubOwner}/
                {results.mutantById.project.githubRepository} · {results.mutantById.filePath}:
                {results.mutantById.startLine}
              </div>
            </Link>
          ) : null}

          {results.projects.length ? (
            <Section title="Projects">
              <ul className="divide-border divide-y">
                {results.projects.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <Link
                        href={routes.project(p.githubOwner, p.githubRepository)}
                        className="font-mono hover:underline"
                      >
                        {p.githubOwner}/{p.githubRepository}
                      </Link>
                      <p className="text-muted-foreground truncate text-xs">
                        {p.description ?? "No description"}
                      </p>
                    </div>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {p.language ?? ""}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {results.users.length ? (
            <Section title="Users">
              <ul className="flex flex-wrap gap-2">
                {results.users.map((u) => (
                  <li key={u.id}>
                    <UserChip
                      user={u}
                      size="sm"
                      showName
                      className="border-border rounded-md border px-2 py-1"
                    />
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {results.mutants.length ? (
            <Section
              title="Mutants"
              description={
                results.mutantTotal > results.mutants.length
                  ? `Showing ${results.mutants.length} of about ${results.mutantTotal}`
                  : undefined
              }
              actions={
                <Button asChild variant="ghost" size="xs">
                  <Link href={`${routes.mutants()}?q=${encodeURIComponent(results.query)}`}>
                    Open in mutant list
                  </Link>
                </Button>
              }
            >
              <MutantTable mutants={results.mutants} />
            </Section>
          ) : null}
        </div>
      ) : null}
    </PageContainer>
  );
}
