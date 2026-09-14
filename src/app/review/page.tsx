import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { reviewService } from "@/server/services/review-service";
import { projectRepository } from "@/server/repositories/project-repository";
import { canAccessReviewQueue, reviewableProjectIds } from "@/domain/auth/permissions";
import { forbidden, isAppError } from "@/lib/errors";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { ErrorState } from "@/components/shared/error-states";
import { ReviewFilters } from "@/components/review/review-filters";
import { ReviewList } from "@/components/review/review-list";
import { ReviewDetailPanel } from "@/components/review/review-detail-panel";
import { buildQuery } from "@/components/mutants/mutant-filters";
import { routes } from "@/lib/routes";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Review queue" };

type SearchParams = Record<string, string | string[] | undefined>;

function firstValues(sp: SearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    const value = Array.isArray(v) ? v[0] : v;
    if (value) out[k] = value;
  }
  return out;
}

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(routes.signIn(routes.review()));
  if (!canAccessReviewQueue(user)) {
    return (
      <PageContainer>
        <ErrorState
          error={forbidden(
            "The review queue is only available to reviewers, maintainers and admins.",
          )}
          backHref={routes.dashboard()}
          backLabel="Go to dashboard"
        />
      </PageContainer>
    );
  }

  const raw = firstValues(await searchParams);
  const selectedId = raw.selected && /^\d+$/.test(raw.selected) ? Number(raw.selected) : null;

  const scope = reviewableProjectIds(user);
  const [queue, allProjects] = await Promise.all([
    reviewService.listQueue(user, raw),
    projectRepository.list({ activeOnly: true }),
  ]);
  const projects = allProjects
    .filter((p) => scope === null || scope.includes(p.id))
    .map((p) => ({
      value: `${p.githubOwner}/${p.githubRepository}`,
      label: `${p.githubOwner}/${p.githubRepository}`,
    }));

  let view = null;
  let detailError: unknown = null;
  if (selectedId) {
    try {
      view = await reviewService.getDetailForReview(user, selectedId);
    } catch (e) {
      if (isAppError(e)) detailError = e;
      else throw e;
    }
  }

  const { filter } = queue;
  const filterQuery = {
    project: filter.project,
    contributor: filter.contributor,
    file: filter.file,
    status: filter.status,
    operator: filter.operator,
    since: filter.since,
    duplicates: filter.duplicates,
    pageSize: filter.pageSize !== 20 ? filter.pageSize : undefined,
  };
  const hrefFor = (id: number) =>
    `${routes.review()}${buildQuery({ ...filterQuery, page: filter.page, selected: id })}`;
  const pageHref = (page: number) =>
    `${routes.review()}${buildQuery({ ...filterQuery, page, selected: selectedId ?? undefined })}`;

  return (
    <PageContainer wide className="space-y-4" data-testid="review-page">
      <PageHeader
        title="Review queue"
        description={`${queue.total} submission${queue.total === 1 ? "" : "s"} awaiting a decision in the projects you moderate.`}
      />
      <ReviewFilters filter={filter} projects={projects} />
      <div className="grid gap-4 lg:grid-cols-[minmax(320px,2fr)_3fr] xl:grid-cols-[minmax(360px,2fr)_3fr]">
        <div className="space-y-3">
          <ReviewList items={queue.items} selectedId={selectedId} hrefFor={hrefFor} />
          <Pagination
            page={filter.page}
            pageSize={filter.pageSize}
            total={queue.total}
            hrefFor={pageHref}
          />
        </div>
        <div className="lg:sticky lg:top-16 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto">
          {detailError ? (
            <div className="border-border bg-card rounded-lg border" data-testid="review-detail">
              <ErrorState
                error={detailError}
                backHref={routes.review()}
                backLabel="Back to queue"
                compact
              />
            </div>
          ) : (
            <ReviewDetailPanel view={view} signedIn />
          )}
        </div>
      </div>
    </PageContainer>
  );
}
