import "server-only";
import { prisma } from "@/server/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type {
  ActivityType,
  MutationOperator,
  MutationStatus,
  ObservedResult,
  ReviewStatus,
  StatusKind,
} from "@/generated/prisma/enums";
import { userSummarySelect } from "./user-repository";
import { notificationRepository } from "./notification-repository";

/** Fields shown in lists (mutant tables, review queue rows, dashboards). */
export const mutantListSelect = {
  id: true,
  title: true,
  filePath: true,
  startLine: true,
  endLine: true,
  mutationOperator: true,
  reviewStatus: true,
  mutationStatus: true,
  fingerprint: true,
  duplicateOfId: true,
  pullRequestId: true,
  createdAt: true,
  updatedAt: true,
  project: {
    select: {
      id: true,
      githubOwner: true,
      githubRepository: true,
      displayName: true,
      language: true,
    },
  },
  revision: { select: { id: true, commitSha: true, branch: true } },
  createdBy: { select: userSummarySelect },
  validations: { select: { result: true } },
  _count: { select: { comments: true, validations: true } },
} satisfies Prisma.MutantSelect;

export type MutantListItem = Prisma.MutantGetPayload<{ select: typeof mutantListSelect }>;

/** Everything the detail page and the review panel need. */
export const mutantDetailInclude = {
  project: true,
  revision: true,
  createdBy: { select: userSummarySelect },
  duplicateOf: { select: { id: true, title: true, reviewStatus: true } },
  duplicates: { select: { id: true, title: true, createdAt: true } },
  submissions: {
    include: { submittedBy: { select: userSummarySelect } },
    orderBy: { createdAt: "asc" },
  },
  validations: {
    include: { user: { select: userSummarySelect } },
    orderBy: { createdAt: "asc" },
  },
  comments: {
    include: { user: { select: userSummarySelect } },
    orderBy: { createdAt: "asc" },
  },
  statusHistory: {
    include: { changedBy: { select: userSummarySelect } },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.MutantInclude;

export type MutantDetail = Prisma.MutantGetPayload<{ include: typeof mutantDetailInclude }>;

/** Fields needed for dataset exports (flattened by `toExportRow`). */
export const mutantExportSelect = {
  id: true,
  title: true,
  description: true,
  filePath: true,
  startLine: true,
  endLine: true,
  mutationOperator: true,
  originalCode: true,
  mutatedCode: true,
  gitDiff: true,
  reviewStatus: true,
  mutationStatus: true,
  createdAt: true,
  updatedAt: true,
  project: { select: { githubOwner: true, githubRepository: true, language: true } },
  revision: { select: { commitSha: true } },
  pullRequest: { select: { number: true } },
  createdBy: { select: { githubUsername: true } },
  submissions: {
    select: {
      observedResult: true,
      buildCommand: true,
      testCommand: true,
      fuzzCommand: true,
      environmentDescription: true,
    },
    orderBy: { createdAt: "desc" },
    take: 1,
  },
  validations: { select: { result: true, killingTestRef: true } },
} satisfies Prisma.MutantSelect;

export type MutantExportRecord = Prisma.MutantGetPayload<{ select: typeof mutantExportSelect }>;

export interface MutantListWhere {
  projectId?: string;
  language?: string;
  mutationOperator?: MutationOperator;
  reviewStatus?: ReviewStatus;
  reviewStatusIn?: ReviewStatus[];
  mutationStatus?: MutationStatus;
  createdByUsername?: string;
  createdById?: string;
  commitShaPrefix?: string;
  filePathContains?: string;
  createdSince?: Date;
  /** Restrict to a set of projects (reviewer scope). */
  projectIdIn?: string[];
  text?: string;
}

export interface Page {
  page: number;
  pageSize: number;
}

export function buildMutantWhere(w: MutantListWhere): Prisma.MutantWhereInput {
  const and: Prisma.MutantWhereInput[] = [];
  if (w.projectId) and.push({ projectId: w.projectId });
  if (w.projectIdIn) and.push({ projectId: { in: w.projectIdIn } });
  if (w.language) and.push({ project: { language: { equals: w.language, mode: "insensitive" } } });
  if (w.mutationOperator) and.push({ mutationOperator: w.mutationOperator });
  if (w.reviewStatus) and.push({ reviewStatus: w.reviewStatus });
  if (w.reviewStatusIn) and.push({ reviewStatus: { in: w.reviewStatusIn } });
  if (w.mutationStatus) and.push({ mutationStatus: w.mutationStatus });
  if (w.createdById) and.push({ createdById: w.createdById });
  if (w.createdByUsername)
    and.push({
      createdBy: { githubUsername: { equals: w.createdByUsername, mode: "insensitive" } },
    });
  if (w.commitShaPrefix) and.push({ revision: { commitSha: { startsWith: w.commitShaPrefix } } });
  if (w.filePathContains)
    and.push({ filePath: { contains: w.filePathContains, mode: "insensitive" } });
  if (w.createdSince) and.push({ createdAt: { gte: w.createdSince } });
  if (w.text) {
    and.push({
      OR: [
        { title: { contains: w.text, mode: "insensitive" } },
        { description: { contains: w.text, mode: "insensitive" } },
        { originalCode: { contains: w.text, mode: "insensitive" } },
        { mutatedCode: { contains: w.text, mode: "insensitive" } },
        { filePath: { contains: w.text, mode: "insensitive" } },
      ],
    });
  }
  return and.length ? { AND: and } : {};
}

export interface CreateMutantData {
  projectId: string;
  revisionId: string;
  filePath: string;
  startLine: number;
  endLine: number;
  originalCode: string;
  mutatedCode: string;
  gitDiff: string;
  mutationOperator: MutationOperator;
  title: string;
  description: string | null;
  fingerprint: string;
  mutationStatus: MutationStatus;
  createdById: string;
  pullRequestId: string | null;
  submission: {
    buildCommand: string | null;
    testCommand: string;
    fuzzCommand: string | null;
    testDurationSeconds: number | null;
    environmentDescription: string;
    operatingSystem: string | null;
    compiler: string | null;
    observedResult: ObservedResult;
    notes: string | null;
    stdout: string | null;
    stderr: string | null;
  };
}

export const mutantRepository = {
  findDetail(id: number) {
    return prisma.mutant.findUnique({ where: { id }, include: mutantDetailInclude });
  },

  findListItem(id: number) {
    return prisma.mutant.findUnique({ where: { id }, select: mutantListSelect });
  },

  async list(where: MutantListWhere, page: Page) {
    const prismaWhere = buildMutantWhere(where);
    const [items, total] = await prisma.$transaction([
      prisma.mutant.findMany({
        where: prismaWhere,
        select: mutantListSelect,
        orderBy: { createdAt: "desc" },
        skip: (page.page - 1) * page.pageSize,
        take: page.pageSize,
      }),
      prisma.mutant.count({ where: prismaWhere }),
    ]);
    return { items, total };
  },

  /** Mutants attached to one file at one revision (for gutter indicators). */
  listForFile(projectId: string, revisionId: string, filePath: string) {
    return prisma.mutant.findMany({
      where: { projectId, revisionId, filePath },
      select: mutantListSelect,
      orderBy: [{ startLine: "asc" }, { createdAt: "asc" }],
    });
  },

  /** Mutants for the same file at *other* revisions, so drift can be surfaced. */
  countForFileOtherRevisions(projectId: string, revisionId: string, filePath: string) {
    return prisma.mutant.count({
      where: { projectId, filePath, revisionId: { not: revisionId } },
    });
  },

  findByFingerprint(fingerprint: string) {
    return prisma.mutant.findMany({
      where: { fingerprint },
      select: mutantListSelect,
      orderBy: { createdAt: "asc" },
    });
  },

  /**
   * Same project + file + normalized code pair at any revision. Uses the code
   * columns directly because the similarity key is not persisted.
   */
  findSimilar(params: {
    projectId: string;
    filePath: string;
    originalCode: string;
    mutatedCode: string;
    excludeFingerprint?: string;
  }) {
    return prisma.mutant.findMany({
      where: {
        projectId: params.projectId,
        filePath: params.filePath,
        fingerprint: params.excludeFingerprint ? { not: params.excludeFingerprint } : undefined,
        OR: [
          {
            originalCode: { contains: params.originalCode.trim(), mode: "insensitive" },
            mutatedCode: { contains: params.mutatedCode.trim(), mode: "insensitive" },
          },
        ],
      },
      select: mutantListSelect,
      orderBy: { createdAt: "asc" },
      take: 10,
    });
  },

  /** Creates the mutant, its submission, the initial history rows and activity atomically. */
  create(data: CreateMutantData) {
    const { submission, ...mutant } = data;
    return prisma.$transaction(async (tx) => {
      const created = await tx.mutant.create({
        data: {
          ...mutant,
          submissions: { create: { ...submission, submittedById: data.createdById } },
          statusHistory: {
            create: [
              {
                kind: "REVIEW",
                previousValue: null,
                newValue: "PENDING",
                changedById: data.createdById,
              },
              {
                kind: "MUTATION",
                previousValue: null,
                newValue: data.mutationStatus,
                changedById: data.createdById,
                comment: "Initial result reported by the submitter",
              },
            ],
          },
        },
      });
      await tx.activity.create({
        data: {
          type: "MUTANT_SUBMITTED",
          actorId: data.createdById,
          projectId: data.projectId,
          mutantId: created.id,
          payload: { title: data.title, filePath: data.filePath, startLine: data.startLine },
        },
      });
      await notificationRepository.recordInTx(tx, {
        type: "MUTANT_SUBMITTED",
        actorId: data.createdById,
        mutantId: created.id,
      });
      return created;
    });
  },

  /** Appends history + activity and updates the status in one transaction. */
  changeStatus(params: {
    mutantId: number;
    kind: StatusKind;
    previousValue: string;
    newValue: string;
    changedById: string;
    comment: string | null;
    activityType: ActivityType | null;
    projectId: string;
    duplicateOfId?: number | null;
  }) {
    const data: Prisma.MutantUpdateInput =
      params.kind === "REVIEW"
        ? {
            reviewStatus: params.newValue as ReviewStatus,
            duplicateOf:
              params.duplicateOfId === undefined
                ? undefined
                : params.duplicateOfId === null
                  ? { disconnect: true }
                  : { connect: { id: params.duplicateOfId } },
          }
        : params.kind === "MUTATION"
          ? { mutationStatus: params.newValue as MutationStatus }
          : {};

    return prisma.$transaction(async (tx) => {
      const updated = await tx.mutant.update({ where: { id: params.mutantId }, data });
      await tx.mutantStatusHistory.create({
        data: {
          mutantId: params.mutantId,
          kind: params.kind,
          previousValue: params.previousValue,
          newValue: params.newValue,
          changedById: params.changedById,
          comment: params.comment,
        },
      });
      if (params.activityType) {
        await tx.activity.create({
          data: {
            type: params.activityType,
            actorId: params.changedById,
            projectId: params.projectId,
            mutantId: params.mutantId,
            payload: {
              kind: params.kind,
              from: params.previousValue,
              to: params.newValue,
              comment: params.comment,
            },
          },
        });
        await notificationRepository.recordInTx(tx, {
          type: params.activityType,
          actorId: params.changedById,
          mutantId: params.mutantId,
          detail: params.comment,
        });
      }
      return updated;
    });
  },

  /** Files with the most mutants in a project. */
  topFiles(projectId: string, take = 8) {
    return prisma.mutant.groupBy({
      by: ["filePath"],
      where: { projectId },
      _count: { _all: true },
      orderBy: { _count: { filePath: "desc" } },
      take,
    });
  },

  /** Contributors ranked by number of mutants in a project. */
  topContributors(projectId: string, take = 8) {
    return prisma.mutant.groupBy({
      by: ["createdById"],
      where: { projectId },
      _count: { _all: true },
      orderBy: { _count: { createdById: "desc" } },
      take,
    });
  },

  /**
   * Applies a contributor edit: mutant fields are replaced, a NEW submission
   * row keeps the previous evidence, and a SUBMISSION history row lists what
   * changed. Location fields are never touched here.
   */
  updateSubmission(params: {
    mutantId: number;
    projectId: string;
    editedById: string;
    fields: Pick<
      CreateMutantData,
      | "title"
      | "mutationOperator"
      | "originalCode"
      | "mutatedCode"
      | "gitDiff"
      | "description"
      | "fingerprint"
    >;
    submission: CreateMutantData["submission"];
    changedFields: string[];
    editReason: string | null;
  }) {
    const summary = params.changedFields.length
      ? `Edited: ${params.changedFields.join(", ")}`
      : "Edited (no field changes)";
    const comment = params.editReason ? `${summary}. ${params.editReason}` : summary;
    return prisma.$transaction(async (tx) => {
      const updated = await tx.mutant.update({
        where: { id: params.mutantId },
        data: {
          ...params.fields,
          submissions: { create: { ...params.submission, submittedById: params.editedById } },
        },
      });
      await tx.mutantStatusHistory.create({
        data: {
          mutantId: params.mutantId,
          kind: "SUBMISSION",
          previousValue: null,
          newValue: "EDITED",
          changedById: params.editedById,
          comment,
        },
      });
      await tx.activity.create({
        data: {
          type: "MUTANT_EDITED",
          actorId: params.editedById,
          projectId: params.projectId,
          mutantId: params.mutantId,
          payload: { changedFields: params.changedFields, reason: params.editReason },
        },
      });
      await notificationRepository.recordInTx(tx, {
        type: "MUTANT_EDITED",
        actorId: params.editedById,
        mutantId: params.mutantId,
        detail: params.editReason ?? summary,
      });
      return updated;
    });
  },

  /** Streams matching mutants in id order, in batches, up to `limit` rows. */
  async *iterateForExport(
    where: MutantListWhere,
    limit: number,
    batchSize = 500,
  ): AsyncGenerator<MutantExportRecord[]> {
    const prismaWhere = buildMutantWhere(where);
    let cursor: number | undefined;
    let remaining = limit;
    while (remaining > 0) {
      const batch = await prisma.mutant.findMany({
        where: cursor ? { AND: [prismaWhere, { id: { gt: cursor } }] } : prismaWhere,
        select: mutantExportSelect,
        orderBy: { id: "asc" },
        take: Math.min(batchSize, remaining),
      });
      if (batch.length === 0) return;
      yield batch;
      remaining -= batch.length;
      cursor = batch[batch.length - 1].id;
      if (batch.length < batchSize) return;
    }
  },

  countPendingReview(projectIdIn: string[] | null) {
    return prisma.mutant.count({
      where: {
        reviewStatus: { in: ["PENDING", "NEEDS_INFORMATION"] },
        projectId: projectIdIn ? { in: projectIdIn } : undefined,
      },
    });
  },

  /** Approved mutants with the fewest reproductions, for the dashboard. */
  suggestedForReproduction(excludeUserId: string, take = 5) {
    return prisma.mutant.findMany({
      where: {
        reviewStatus: "APPROVED",
        mutationStatus: { in: ["SURVIVED", "UNKNOWN"] },
        createdById: { not: excludeUserId },
        validations: { none: { userId: excludeUserId } },
      },
      select: mutantListSelect,
      orderBy: [{ validations: { _count: "asc" } }, { createdAt: "desc" }],
      take,
    });
  },
};
