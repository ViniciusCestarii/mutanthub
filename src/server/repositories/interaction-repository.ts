import "server-only";
import { prisma } from "@/server/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { ActivityType, ValidationResult } from "@/generated/prisma/enums";
import { userSummarySelect } from "./user-repository";
import { notificationRepository } from "./notification-repository";

/**
 * Validations, comments and the activity feed. Grouped together because they
 * are small and always written alongside an activity row.
 */

export const activityInclude = {
  actor: { select: userSummarySelect },
  project: { select: { id: true, githubOwner: true, githubRepository: true, displayName: true } },
  mutant: { select: { id: true, title: true, filePath: true, startLine: true } },
} satisfies Prisma.ActivityInclude;

export type ActivityItem = Prisma.ActivityGetPayload<{ include: typeof activityInclude }>;

export const validationRepository = {
  create(data: {
    mutantId: number;
    userId: string;
    projectId: string;
    result: ValidationResult;
    command: string | null;
    environment: string | null;
    notes: string | null;
    killingTestRef: string | null;
    commitSha: string | null;
    killClaimId: string | null;
  }) {
    return prisma.$transaction(async (tx) => {
      const validation = await tx.validation.create({
        data: {
          mutantId: data.mutantId,
          userId: data.userId,
          result: data.result,
          command: data.command,
          environment: data.environment,
          notes: data.notes,
          killingTestRef: data.killingTestRef,
          commitSha: data.commitSha,
          killClaimId: data.killClaimId,
        },
        include: { user: { select: userSummarySelect } },
      });
      await tx.activity.create({
        data: {
          type: "MUTANT_REPRODUCED",
          actorId: data.userId,
          projectId: data.projectId,
          mutantId: data.mutantId,
          payload: { result: data.result, killingTestRef: data.killingTestRef },
        },
      });
      await notificationRepository.recordInTx(tx, {
        type: "MUTANT_REPRODUCED",
        actorId: data.userId,
        mutantId: data.mutantId,
        detail: data.result,
      });
      return validation;
    });
  },

  listRecentForProject(projectId: string, take = 8) {
    return prisma.validation.findMany({
      where: { mutant: { projectId } },
      include: {
        user: { select: userSummarySelect },
        mutant: { select: { id: true, title: true, filePath: true } },
      },
      orderBy: { createdAt: "desc" },
      take,
    });
  },

  countByUser(userId: string) {
    return prisma.validation.count({ where: { userId } });
  },
};

export const commentRepository = {
  create(data: { mutantId: number; userId: string; projectId: string; body: string }) {
    return prisma.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: { mutantId: data.mutantId, userId: data.userId, body: data.body },
        include: { user: { select: userSummarySelect } },
      });
      await tx.activity.create({
        data: {
          type: "COMMENT_ADDED",
          actorId: data.userId,
          projectId: data.projectId,
          mutantId: data.mutantId,
          payload: { excerpt: data.body.slice(0, 140) },
        },
      });
      await notificationRepository.recordInTx(tx, {
        type: "COMMENT_ADDED",
        actorId: data.userId,
        mutantId: data.mutantId,
        detail: data.body,
      });
      return comment;
    });
  },

  findById(id: string) {
    return prisma.comment.findUnique({
      where: { id },
      include: { mutant: { select: { projectId: true } } },
    });
  },

  update(id: string, body: string) {
    return prisma.comment.update({ where: { id }, data: { body } });
  },

  delete(id: string) {
    return prisma.comment.delete({ where: { id } });
  },
};

export const activityRepository = {
  /** Records an activity and fans out notifications in one transaction (for non-mutant-row events). */
  recordEvent(data: {
    type: ActivityType;
    actorId: string | null;
    projectId: string;
    mutantId: number;
    payload?: Prisma.InputJsonValue;
    /** Free text shown in the notification body/title. */
    detail?: string | null;
  }) {
    return prisma.$transaction(async (tx) => {
      const activity = await tx.activity.create({
        data: {
          type: data.type,
          actorId: data.actorId,
          projectId: data.projectId,
          mutantId: data.mutantId,
          payload: data.payload,
        },
      });
      await notificationRepository.recordInTx(tx, {
        type: data.type,
        actorId: data.actorId,
        mutantId: data.mutantId,
        detail: data.detail ?? null,
      });
      return activity;
    });
  },

  listRecent(opts: {
    projectId?: string;
    actorId?: string;
    mutantId?: number;
    types?: ActivityType[];
    take?: number;
  }) {
    return prisma.activity.findMany({
      where: {
        projectId: opts.projectId,
        actorId: opts.actorId,
        mutantId: opts.mutantId,
        type: opts.types ? { in: opts.types } : undefined,
      },
      include: activityInclude,
      orderBy: { createdAt: "desc" },
      take: opts.take ?? 20,
    });
  },

  /** Activity on mutants the user created or interacted with, excluding their own actions. */
  listRelevantForUser(userId: string, take = 20) {
    return prisma.activity.findMany({
      where: {
        actorId: { not: userId },
        mutant: {
          OR: [
            { createdById: userId },
            { validations: { some: { userId } } },
            { comments: { some: { userId } } },
          ],
        },
      },
      include: activityInclude,
      orderBy: { createdAt: "desc" },
      take,
    });
  },
};
