import "server-only";
import type { Principal } from "@/domain/auth/permissions";
import {
  canChangeMutationStatus,
  canReviewProject,
  reviewableProjectIds,
} from "@/domain/auth/permissions";
import {
  canTransitionMutation,
  canTransitionReview,
  MUTATION_STATUS_ACTIVITY,
  REVIEW_ACTION_TO_STATUS,
  REVIEW_STATUS_ACTIVITY,
} from "@/domain/mutants/status";
import { forbidden, notFound, validationError } from "@/lib/errors";
import { enforceRateLimit, RATE_LIMITS } from "@/server/infra/rate-limit";
import {
  changeMutationStatusSchema,
  fieldErrors,
  reviewMutantSchema,
  reviewQueueFilterSchema,
  type ReviewQueueFilter,
} from "@/lib/validation/schemas";
import { mutantRepository, type MutantListItem } from "@/server/repositories/mutant-repository";
import { projectRepository } from "@/server/repositories/project-repository";
import { auditRepository } from "@/server/repositories/audit-repository";
import { mutantService } from "./mutant-service";

export interface ReviewQueueItem extends MutantListItem {
  possibleDuplicate: boolean;
}

export const reviewService = {
  /** Review queue restricted to the projects the principal may moderate. */
  async listQueue(principal: Principal | null, rawFilter: unknown) {
    const scope = reviewableProjectIds(principal);
    if (scope !== null && scope.length === 0)
      throw forbidden("You are not a reviewer of any project");

    const parsed = reviewQueueFilterSchema.safeParse(rawFilter);
    const filter: ReviewQueueFilter = parsed.success
      ? parsed.data
      : reviewQueueFilterSchema.parse({});

    let projectId: string | undefined;
    if (filter.project) {
      const [owner, repo] = filter.project.split("/");
      const project = owner && repo ? await projectRepository.findBySlug(owner, repo) : null;
      if (!project) return { items: [] as ReviewQueueItem[], total: 0, filter };
      projectId = project.id;
    }

    const result = await mutantRepository.list(
      {
        projectId,
        projectIdIn: scope ?? undefined,
        reviewStatus: filter.status,
        reviewStatusIn: filter.status ? undefined : ["PENDING", "NEEDS_INFORMATION"],
        createdByUsername: filter.contributor,
        filePathContains: filter.file,
        mutationOperator: filter.operator,
        createdSince: filter.since ? new Date(`${filter.since}T00:00:00Z`) : undefined,
      },
      { page: filter.page, pageSize: filter.pageSize },
    );

    // Flag rows that share a fingerprint with another mutant.
    const fingerprints = result.items.map((m) => m.fingerprint);
    const siblings = await Promise.all(
      fingerprints.map((f) => mutantRepository.findByFingerprint(f)),
    );
    let items: ReviewQueueItem[] = result.items.map((m, i) => ({
      ...m,
      possibleDuplicate: siblings[i].some((s) => s.id !== m.id),
    }));
    if (filter.duplicates === "only") items = items.filter((i) => i.possibleDuplicate);
    if (filter.duplicates === "hide") items = items.filter((i) => !i.possibleDuplicate);

    return { items, total: result.total, filter };
  },

  countQueue(principal: Principal | null) {
    const scope = reviewableProjectIds(principal);
    if (scope !== null && scope.length === 0) return Promise.resolve(0);
    return mutantRepository.countPendingReview(scope);
  },

  /** Approve / reject / needs information / mark duplicate. */
  async review(principal: Principal | null, rawInput: unknown) {
    if (!principal) throw forbidden("Sign in to review");
    const parsed = reviewMutantSchema.safeParse(rawInput);
    if (!parsed.success) throw validationError("Invalid review", fieldErrors(parsed.error));
    const input = parsed.data;

    const mutant = await mutantRepository.findListItem(input.mutantId);
    if (!mutant) throw notFound("Mutant");
    if (!canReviewProject(principal, mutant.project.id))
      throw forbidden("Only reviewers of this project can moderate it");
    await enforceRateLimit({ ...RATE_LIMITS.review, action: "review", subject: principal.id });

    const newStatus = REVIEW_ACTION_TO_STATUS[input.action];
    if (!canTransitionReview(mutant.reviewStatus, newStatus))
      throw validationError(
        `Mutant is already ${mutant.reviewStatus.toLowerCase().replace("_", " ")}`,
      );

    let duplicateOfId: number | null | undefined;
    if (input.action === "MARK_DUPLICATE") {
      if (!input.duplicateOfId)
        throw validationError("Choose the original mutant", { duplicateOfId: "Required" });
      if (input.duplicateOfId === mutant.id)
        throw validationError("A mutant cannot duplicate itself", {
          duplicateOfId: "Choose another mutant",
        });
      const original = await mutantRepository.findListItem(input.duplicateOfId);
      if (!original || original.project.id !== mutant.project.id)
        throw validationError("Original mutant not found in this project", {
          duplicateOfId: "Not found in this project",
        });
      duplicateOfId = original.id;
    } else if (mutant.duplicateOfId) {
      duplicateOfId = null;
    }

    const updated = await mutantRepository.changeStatus({
      mutantId: mutant.id,
      kind: "REVIEW",
      previousValue: mutant.reviewStatus,
      newValue: newStatus,
      changedById: principal.id,
      comment: input.comment ?? null,
      activityType: REVIEW_STATUS_ACTIVITY[newStatus],
      projectId: mutant.project.id,
      duplicateOfId,
    });
    await auditRepository.record({
      actorId: principal.id,
      action: "MUTANT_REVIEWED",
      projectId: mutant.project.id,
      targetType: "mutant",
      targetId: String(mutant.id),
      metadata: { from: mutant.reviewStatus, to: newStatus, duplicateOfId: duplicateOfId ?? null },
    });
    return updated;
  },

  /** Changes the scientific outcome (e.g. SURVIVED -> KILLED, or -> EQUIVALENT). */
  async changeMutationStatus(principal: Principal | null, rawInput: unknown) {
    if (!principal) throw forbidden("Sign in to continue");
    const parsed = changeMutationStatusSchema.safeParse(rawInput);
    if (!parsed.success) throw validationError("Invalid status change", fieldErrors(parsed.error));
    const input = parsed.data;

    const mutant = await mutantRepository.findListItem(input.mutantId);
    if (!mutant) throw notFound("Mutant");
    if (!canChangeMutationStatus(principal, mutant.project.id))
      throw forbidden("Only reviewers can classify mutants");
    await enforceRateLimit({ ...RATE_LIMITS.review, action: "review", subject: principal.id });
    if (!canTransitionMutation(mutant.mutationStatus, input.status))
      throw validationError(`Mutant is already ${input.status.toLowerCase()}`);

    const updated = await mutantRepository.changeStatus({
      mutantId: mutant.id,
      kind: "MUTATION",
      previousValue: mutant.mutationStatus,
      newValue: input.status,
      changedById: principal.id,
      comment: input.comment ?? null,
      activityType: MUTATION_STATUS_ACTIVITY[input.status],
      projectId: mutant.project.id,
    });
    await auditRepository.record({
      actorId: principal.id,
      action: "MUTANT_CLASSIFIED",
      projectId: mutant.project.id,
      targetType: "mutant",
      targetId: String(mutant.id),
      metadata: { from: mutant.mutationStatus, to: input.status },
    });
    return updated;
  },

  getDetailForReview(principal: Principal | null, id: number) {
    return mutantService.getDetail(principal, id);
  },
};
