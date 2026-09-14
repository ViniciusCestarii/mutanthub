import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { mutantService } from "@/server/services/mutant-service";
import { AppError, isAppError } from "@/lib/errors";
import { routes } from "@/lib/routes";
import { shortSha } from "@/lib/format";
import { languageForPath } from "@/components/code/language";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/error-states";
import { ReviewStatusBadge } from "@/components/mutants/status-badge";
import { EditMutantForm } from "@/components/mutant-detail/edit-mutant-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Edit mutation #${id}` };
}

export default async function EditMutantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const user = await getCurrentUser();
  if (!user) redirect(routes.signIn(routes.mutantEdit(id)));

  let view;
  try {
    view = await mutantService.getDetail(user, id);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const { mutant } = view;

  if (!view.lifecycle.canEdit) {
    const reason =
      mutant.createdById !== user.id && user.globalRole !== "ADMIN"
        ? "Only the submitter can edit this mutant."
        : `A ${mutant.reviewStatus.toLowerCase().replace("_", " ")} mutant can no longer be edited.`;
    return (
      <PageContainer>
        <ErrorState
          error={new AppError("FORBIDDEN", reason)}
          backHref={routes.mutant(id)}
          backLabel="Back to mutant"
        />
      </PageContainer>
    );
  }

  const latest = mutant.submissions[mutant.submissions.length - 1];

  return (
    <PageContainer className="max-w-4xl space-y-6">
      <PageHeader
        eyebrow={
          <span className="flex flex-wrap items-center gap-2">
            <Link href={routes.mutant(id)} className="font-mono hover:underline">
              Mutation #{id}
            </Link>
            <ReviewStatusBadge status={mutant.reviewStatus} />
          </span>
        }
        title="Edit submission"
        description={
          <>
            <span className="font-mono">
              {mutant.project.githubOwner}/{mutant.project.githubRepository}
            </span>{" "}
            ·{" "}
            <span className="font-mono">
              {mutant.filePath}:{mutant.startLine}
            </span>{" "}
            · commit <span className="font-mono">{shortSha(mutant.revision.commitSha)}</span>. The
            location cannot change: a mutant elsewhere is a different mutant. Previous evidence
            stays in the history.
          </>
        }
      />
      <EditMutantForm
        initial={{
          mutantId: mutant.id,
          filePath: mutant.filePath,
          startLine: mutant.startLine,
          language: languageForPath(mutant.filePath),
          title: mutant.title,
          mutationOperator: mutant.mutationOperator,
          originalCode: mutant.originalCode,
          mutatedCode: mutant.mutatedCode,
          gitDiff: mutant.gitDiff,
          description: mutant.description ?? "",
          buildCommand: latest?.buildCommand ?? "",
          testCommand: latest?.testCommand ?? "",
          fuzzCommand: latest?.fuzzCommand ?? "",
          testDurationSeconds: latest?.testDurationSeconds ?? null,
          environmentDescription: latest?.environmentDescription ?? "",
          operatingSystem: latest?.operatingSystem ?? "",
          compiler: latest?.compiler ?? "",
          observedResult: latest?.observedResult ?? "UNKNOWN",
          notes: latest?.notes ?? "",
          stdout: latest?.stdout ?? "",
          stderr: latest?.stderr ?? "",
        }}
      />
    </PageContainer>
  );
}
