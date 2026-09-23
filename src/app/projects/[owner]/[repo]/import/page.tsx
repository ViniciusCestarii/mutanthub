import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { projectService } from "@/server/services/project-service";
import { importService } from "@/server/services/import-service";
import { canManageProject } from "@/domain/auth/permissions";
import { IMPORT_MAX_ROWS } from "@/domain/import/schema";
import { AppError, isAppError } from "@/lib/errors";
import { routes } from "@/lib/routes";
import { absoluteDateTime } from "@/lib/format";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { Section } from "@/components/shared/section";
import { ErrorState } from "@/components/shared/error-states";
import { CodeBlock } from "@/components/code/code-block";
import { UserChip } from "@/components/shared/user-chip";
import { ImportWizard } from "@/components/imports/import-wizard";

export const dynamic = "force-dynamic";

type Params = Promise<{ owner: string; repo: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { owner, repo } = await params;
  return { title: `Import mutants · ${owner}/${repo}` };
}

const EXAMPLE = `{
  "tool": { "name": "mull", "version": "0.24.0" },
  "defaults": {
    "commit": "9b2e4d6f8a0c1e3b5d7f9a1c3e5b7d9f1a3c5e7b",
    "testCommand": "ctest --test-dir build --output-on-failure",
    "environment": "Ubuntu 24.04, clang 18",
    "observedResult": "SURVIVED"
  },
  "mutants": [
    {
      "file": "src/script/interpreter.cpp",
      "startLine": 60,
      "originalCode": "    } else if (data.size() <= 75) {",
      "mutatedCode": "    } else if (data.size() < 75) {",
      "mutationOperator": "RELATIONAL_OPERATOR",
      "tool": { "mutantId": "cxx_le_to_lt:60:34" }
    }
  ]
}`;

export default async function ImportPage({ params }: { params: Params }) {
  const { owner, repo } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(routes.signIn(routes.projectImport(owner, repo)));
  let project;
  try {
    project = await projectService.getBySlugOrThrow(owner, repo);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  if (!canManageProject(user, project.id)) {
    return (
      <PageContainer>
        <ErrorState
          error={
            new AppError(
              "FORBIDDEN",
              "Only project maintainers and administrators can import mutants.",
            )
          }
          backHref={routes.project(owner, repo)}
          backLabel="Back to project"
        />
      </PageContainer>
    );
  }
  const batches = await importService.listBatches(project.id);

  return (
    <PageContainer className="space-y-4" wide>
      <div data-testid="import-page">
        <PageHeader
          eyebrow={
            <Link href={routes.project(owner, repo)} className="font-mono hover:underline">
              {project.githubOwner}/{project.githubRepository}
            </Link>
          }
          title="Import mutants"
          description={`Upload the output of a mutation testing tool. Every row is validated against the repository (commit, file, original code at the stated line) and checked for duplicates before anything is written. Imported mutants are created as approved. Up to ${IMPORT_MAX_ROWS.toLocaleString()} rows per file.`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Section title="Upload" description="Dry run first, then confirm">
            <ImportWizard owner={project.githubOwner} repo={project.githubRepository} />
          </Section>
          <Section title="Previous imports">
            {batches.length === 0 ? (
              <p className="text-muted-foreground text-xs">No imports yet.</p>
            ) : (
              <ul className="divide-border divide-y text-sm" data-testid="import-batches">
                {batches.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                    <Link
                      href={`${routes.projectMutants(owner, repo)}?batch=${b.id}`}
                      className="font-medium hover:underline"
                    >
                      {b.createdCount} mutants from {b.toolName}
                      {b.toolVersion ? ` ${b.toolVersion}` : ""}
                    </Link>
                    <span className="text-muted-foreground text-xs">
                      {b.fileName ?? "file"} · {b.rowCount} rows · {b.skippedCount} skipped ·{" "}
                      {b.errorCount} errors · {absoluteDateTime(b.createdAt)}
                    </span>
                    {b.importedBy ? <UserChip user={b.importedBy} size="xs" /> : null}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
        <aside className="space-y-4">
          <Section title="File format" description="JSON, or JSON Lines with one row per line">
            <p className="text-muted-foreground mb-2 text-xs">
              Field names match the dataset export. Required per row:{" "}
              <span className="font-mono">file</span>, <span className="font-mono">startLine</span>,{" "}
              <span className="font-mono">originalCode</span>,{" "}
              <span className="font-mono">mutatedCode</span>;{" "}
              <span className="font-mono">commit</span>,{" "}
              <span className="font-mono">testCommand</span> and{" "}
              <span className="font-mono">observedResult</span> may come from{" "}
              <span className="font-mono">defaults</span>. See{" "}
              <Link href="/docs/import" className="underline">
                the import guide
              </Link>{" "}
              in the repository docs.
            </p>
            <CodeBlock label="Example" code={EXAMPLE} />
          </Section>
        </aside>
      </div>
    </PageContainer>
  );
}
