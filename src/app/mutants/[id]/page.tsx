import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { mutantService } from "@/server/services/mutant-service";
import { isAppError } from "@/lib/errors";
import { PageContainer } from "@/components/shared/page-header";
import { Section } from "@/components/shared/section";
import { Markdown } from "@/components/shared/markdown";
import { MutantHeader } from "@/components/mutant-detail/mutant-header";
import { MutantNotices } from "@/components/mutant-detail/mutant-notices";
import { DiffSection } from "@/components/mutant-detail/diff-section";
import { EvidenceSection } from "@/components/mutant-detail/evidence-section";
import { DiscussionSection } from "@/components/mutant-detail/discussion-section";
import { ReproductionSection } from "@/components/mutant-detail/reproduction-section";
import { HistorySection } from "@/components/mutant-detail/history-section";
import { ReviewActions } from "@/components/review/review-actions";
import { LifecycleActions } from "@/components/mutant-detail/lifecycle-actions";
import { KillClaimsSection } from "@/components/mutant-detail/kill-claims-section";
import { killClaimService } from "@/server/services/kill-claim-service";
import { referenceLabel } from "@/domain/kill-claims/reference";

export const dynamic = "force-dynamic";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function loadView(rawId: string, user: Awaited<ReturnType<typeof getCurrentUser>>) {
  const id = parseId(rawId);
  if (!id) notFound();
  try {
    return await mutantService.getDetail(user, id);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Mutation #${id}` };
}

export default async function MutantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const view = await loadView(id, user);
  const { mutant } = view;
  const claims = await killClaimService.listForMutant(mutant.id);
  const claimOptions = claims
    .filter((c) => c.status === "CLAIMED" || c.status === "STALE")
    .map((c) => ({
      id: c.id,
      label: `${referenceLabel(c.kind, c.reference)}${c.verifyCommitSha ? ` at ${c.verifyCommitSha.slice(0, 7)}` : ""}`,
      commitSha: c.verifyCommitSha,
    }));

  return (
    <PageContainer wide className="space-y-4" data-testid="mutant-page">
      <MutantHeader mutant={mutant} />
      <MutantNotices view={view} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <DiffSection
            mutantId={mutant.id}
            filePath={mutant.filePath}
            originalCode={mutant.originalCode}
            mutatedCode={mutant.mutatedCode}
            gitDiff={mutant.gitDiff}
          />
          {mutant.description ? (
            <Section title="Description">
              <Markdown source={mutant.description} />
            </Section>
          ) : null}
          <EvidenceSection submissions={mutant.submissions} />
          <DiscussionSection
            mutantId={mutant.id}
            comments={mutant.comments}
            signedIn={Boolean(user)}
          />
        </div>

        <aside className="space-y-4">
          {view.lifecycle.canEdit || view.lifecycle.canResubmit || view.lifecycle.canWithdraw ? (
            <Section title="Your submission" description="Edit, resubmit or withdraw">
              <LifecycleActions
                mutantId={mutant.id}
                reviewStatus={mutant.reviewStatus}
                canEdit={view.lifecycle.canEdit}
                canResubmit={view.lifecycle.canResubmit}
                canWithdraw={view.lifecycle.canWithdraw}
              />
            </Section>
          ) : null}
          {view.canReview ? (
            <Section title="Review" description="Moderation and classification">
              <ReviewActions
                mutantId={mutant.id}
                reviewStatus={mutant.reviewStatus}
                mutationStatus={mutant.mutationStatus}
              />
            </Section>
          ) : null}
          <ReproductionSection
            mutantId={mutant.id}
            summary={view.validationSummary}
            validations={mutant.validations}
            signedIn={Boolean(user)}
            claims={claimOptions}
          />
          <KillClaimsSection
            mutantId={mutant.id}
            project={{ owner: mutant.project.githubOwner, repo: mutant.project.githubRepository }}
            claims={claims}
            signedIn={Boolean(user)}
            canReview={view.canReview}
          />
          <HistorySection history={mutant.statusHistory} />
          {mutant.duplicates.length > 0 ? (
            <Section title="Duplicates of this mutant">
              <ul className="space-y-1 text-xs">
                {mutant.duplicates.map((d) => (
                  <li key={d.id}>
                    <a href={`/mutants/${d.id}`} className="font-mono hover:underline">
                      #{d.id}
                    </a>{" "}
                    {d.title}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </aside>
      </div>
    </PageContainer>
  );
}
