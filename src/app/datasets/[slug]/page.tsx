import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { datasetService, citationFor } from "@/server/services/dataset-service";
import { isAppError } from "@/lib/errors";
import { routes } from "@/lib/routes";
import { absoluteDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { Section } from "@/components/shared/section";
import { Stat } from "@/components/shared/stat";
import { CodeBlock } from "@/components/code/code-block";
import { UserChip } from "@/components/shared/user-chip";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Snapshot ${slug}` };
}

export default async function SnapshotPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let snapshot;
  try {
    snapshot = await datasetService.getBySlug(slug);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const baseUrl = (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const filters = (snapshot.filters ?? {}) as Record<string, string | number>;

  return (
    <PageContainer className="max-w-4xl space-y-4">
      <div data-testid="snapshot-page">
        <PageHeader
          eyebrow={
            <Link href={routes.datasets()} className="hover:underline">
              Dataset · snapshots
            </Link>
          }
          title={snapshot.name}
          description={snapshot.description ?? "Frozen, citable release of the mutant catalogue."}
          actions={
            <>
              <Button asChild size="sm" data-testid="snapshot-download-json">
                <a href={routes.snapshotDownload(snapshot.slug, "json")}>
                  <Download className="size-3.5" aria-hidden /> JSON
                </a>
              </Button>
              <Button asChild size="sm" variant="outline" data-testid="snapshot-download-csv">
                <a href={routes.snapshotDownload(snapshot.slug, "csv")}>
                  <Download className="size-3.5" aria-hidden /> CSV
                </a>
              </Button>
            </>
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Rows" value={snapshot.rowCount} />
        <Stat
          label="Published"
          value={absoluteDateTime(snapshot.createdAt).split(" ")[0]}
          hint={absoluteDateTime(snapshot.createdAt)}
        />
        <Stat label="Format" value="JSON · CSV" />
        <Stat
          label="Hash"
          value={<span className="font-mono text-xs">{snapshot.contentHash.slice(0, 16)}</span>}
          hint="SHA-256, canonical rows"
        />
      </div>

      <Section title="Citation" description="Permanent URL and content hash">
        <CodeBlock code={citationFor(snapshot, baseUrl)} label="Cite as" />
        {snapshot.createdBy ? (
          <p className="text-muted-foreground mt-2 text-xs">
            Published by <UserChip user={snapshot.createdBy} size="xs" />
          </p>
        ) : null}
      </Section>

      <Section title="Selection" description="Filters used to build this snapshot">
        {Object.keys(filters).length ? (
          <dl
            className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs"
            data-testid="snapshot-filters"
          >
            {Object.entries(filters).map(([key, value]) => (
              <div key={key} className="contents">
                <dt className="text-muted-foreground font-mono">{key}</dt>
                <dd className="font-mono">{String(value)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-muted-foreground text-xs">All mutants at publication time.</p>
        )}
      </Section>

      <Section title="Verify" description="Check a downloaded file against the published hash">
        <CodeBlock
          code={`curl -sL "${baseUrl}${routes.snapshotDownload(snapshot.slug, "json")}" -o ${snapshot.slug}.json\n# rows are hashed in canonical form; compare the X-Dataset-Sha256 response header with:\n# ${snapshot.contentHash}`}
          label="Shell"
        />
      </Section>
    </PageContainer>
  );
}
