import type { Metadata } from "next";
import Link from "next/link";
import { Database, Download } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { datasetService } from "@/server/services/dataset-service";
import { projectRepository } from "@/server/repositories/project-repository";
import { statsRepository } from "@/server/repositories/stats-repository";
import { isAdmin } from "@/domain/auth/permissions";
import { EXPORT_DEFAULT_ROWS, EXPORT_MAX_ROWS } from "@/domain/dataset/export-row";
import { routes } from "@/lib/routes";
import { absoluteDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { Section } from "@/components/shared/section";
import { EmptyState } from "@/components/shared/empty-state";
import { CodeBlock } from "@/components/code/code-block";
import { UserChip } from "@/components/shared/user-chip";
import { CreateSnapshotForm } from "@/components/datasets/create-snapshot-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dataset" };

export default async function DatasetsPage() {
  const [user, snapshots, projects, counts] = await Promise.all([
    getCurrentUser(),
    datasetService.list(),
    projectRepository.list({ activeOnly: true }),
    statsRepository.globalCounts(),
  ]);

  return (
    <PageContainer className="space-y-4">
      <div data-testid="datasets-page">
        <PageHeader
          title="Dataset"
          description="Every mutant, its location, outcome, test evidence and reproductions, as machine-readable data. Live exports reflect the catalogue right now; snapshots are frozen, hashed releases you can cite."
        />
      </div>

      <Section
        title="What the fields mean"
        description="Read this before drawing conclusions from the data"
      >
        <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
          <li>
            <span className="text-foreground font-medium">mutationStatus = SURVIVED</span> means the
            tests recorded in the submission did not detect the mutant. It does not mean the test
            suite is wrong: the mutant may be equivalent, environment-dependent or not reproduced
            yet.
          </li>
          <li>
            <span className="text-foreground font-medium">reviewStatus</span> is moderation state
            (pending, approved, rejected, duplicate, withdrawn) and is independent of the outcome.
            For analyses, filter on <span className="font-mono">reviewStatus=APPROVED</span>.
          </li>
          <li>
            <span className="text-foreground font-medium">commit</span> is the exact revision the
            mutant was recorded against; line numbers refer to that revision, never to a branch
            head.
          </li>
          <li>
            Reproduction counts come from other contributors; conflicting results are visible as
            both survived and killed counts being non-zero.
          </li>
        </ul>
      </Section>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Section
            title="Snapshots"
            description={`${snapshots.length} published release${snapshots.length === 1 ? "" : "s"}`}
          >
            {snapshots.length === 0 ? (
              <EmptyState
                icon={Database}
                title="No snapshots yet"
                description="Administrators publish snapshots from this page. Until then, use the live export."
                compact
              />
            ) : (
              <ul className="divide-border divide-y" data-testid="snapshot-list">
                {snapshots.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm"
                    data-testid="snapshot-row"
                  >
                    <div className="min-w-0 flex-1">
                      <Link href={routes.dataset(s.slug)} className="font-medium hover:underline">
                        {s.name}
                      </Link>
                      <div className="text-muted-foreground flex flex-wrap gap-x-2 text-xs">
                        <span>{absoluteDate(s.createdAt)}</span>
                        <span>{s.rowCount} rows</span>
                        <span className="font-mono">{s.contentHash.slice(0, 12)}</span>
                        {s.createdBy ? <UserChip user={s.createdBy} size="xs" /> : null}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button asChild variant="outline" size="xs">
                        <a href={routes.snapshotDownload(s.slug, "json")}>JSON</a>
                      </Button>
                      <Button asChild variant="outline" size="xs">
                        <a href={routes.snapshotDownload(s.slug, "csv")}>CSV</a>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Live export"
            description={`${counts.total} mutants in the catalogue right now`}
          >
            <p className="text-muted-foreground mb-3 text-xs">
              Streams straight from the database. Accepts the same filters as the list API (
              <span className="font-mono">project</span>,{" "}
              <span className="font-mono">reviewStatus</span>,{" "}
              <span className="font-mono">mutationStatus</span>,{" "}
              <span className="font-mono">operator</span>,{" "}
              <span className="font-mono">language</span>,{" "}
              <span className="font-mono">contributor</span>,{" "}
              <span className="font-mono">commit</span>, <span className="font-mono">file</span>,{" "}
              <span className="font-mono">q</span>) plus <span className="font-mono">limit</span>{" "}
              (default {EXPORT_DEFAULT_ROWS.toLocaleString()}, max{" "}
              {EXPORT_MAX_ROWS.toLocaleString()}).
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm" data-testid="export-json">
                <a href={routes.exportMutants("json")}>
                  <Download className="size-3.5" aria-hidden /> All mutants, JSON
                </a>
              </Button>
              <Button asChild variant="outline" size="sm" data-testid="export-csv">
                <a href={routes.exportMutants("csv")}>
                  <Download className="size-3.5" aria-hidden /> All mutants, CSV
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a
                  href={routes.exportMutants(
                    "csv",
                    "reviewStatus=APPROVED&mutationStatus=SURVIVED",
                  )}
                >
                  <Download className="size-3.5" aria-hidden /> Approved and surviving, CSV
                </a>
              </Button>
            </div>
            <CodeBlock
              className="mt-3"
              label="Example"
              code={`curl -L "${routes.exportMutants("csv", "project=curl/curl&reviewStatus=APPROVED")}" -o curl-mutants.csv`}
            />
          </Section>
        </div>

        <aside className="space-y-4">
          {user && isAdmin(user) ? (
            <Section title="Publish a snapshot" description="Administrators only">
              <CreateSnapshotForm
                projects={projects.map((p) => ({
                  slug: `${p.githubOwner}/${p.githubRepository}`,
                  name: p.displayName,
                }))}
              />
            </Section>
          ) : (
            <Section title="Citing the data">
              <p className="text-muted-foreground text-xs">
                Cite a snapshot rather than the live export: each snapshot page shows a citation
                with its permanent URL and SHA-256 hash, and its contents never change.
              </p>
            </Section>
          )}
        </aside>
      </div>
    </PageContainer>
  );
}
