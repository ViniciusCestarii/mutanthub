import "server-only";
import { prisma } from "@/server/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { ActivityType } from "@/generated/prisma/enums";
import { buildNotifications } from "@/domain/notifications/build";
import { userSummarySelect } from "./user-repository";

export interface NotificationEventInput {
  type: ActivityType;
  actorId: string | null;
  mutantId: number;
  /** Review note, comment excerpt, reproduction result... shown as the body. */
  detail?: string | null;
}

export const notificationInclude = {
  actor: { select: userSummarySelect },
  mutant: { select: { id: true, title: true, filePath: true, startLine: true } },
  project: { select: { id: true, githubOwner: true, githubRepository: true, displayName: true } },
} satisfies Prisma.NotificationInclude;

export type NotificationItem = Prisma.NotificationGetPayload<{
  include: typeof notificationInclude;
}>;

export const notificationRepository = {
  /**
   * Fans an activity event out to its recipients. Called inside the same
   * transaction that records the activity, so inbox and feed never diverge.
   */
  async recordInTx(tx: Prisma.TransactionClient, event: NotificationEventInput): Promise<number> {
    const mutant = await tx.mutant.findUnique({
      where: { id: event.mutantId },
      select: {
        id: true,
        title: true,
        createdById: true,
        projectId: true,
        project: { select: { displayName: true } },
        comments: { select: { userId: true }, distinct: ["userId"] },
        validations: { select: { userId: true }, distinct: ["userId"] },
      },
    });
    if (!mutant) return 0;
    const [reviewers, actor] = await Promise.all([
      tx.projectMember.findMany({
        where: { projectId: mutant.projectId, role: { in: ["REVIEWER", "MAINTAINER"] } },
        select: { userId: true },
      }),
      event.actorId
        ? tx.user.findUnique({ where: { id: event.actorId }, select: { githubUsername: true } })
        : Promise.resolve(null),
    ]);

    const drafts = buildNotifications(
      {
        type: event.type,
        actorId: event.actorId,
        actorUsername: actor?.githubUsername ?? null,
        mutant: { id: mutant.id, title: mutant.title, createdById: mutant.createdById },
        projectName: mutant.project.displayName,
        detail: event.detail ?? null,
      },
      {
        commenterIds: mutant.comments.map((c) => c.userId),
        validatorIds: mutant.validations.map((v) => v.userId),
        reviewerIds: reviewers.map((r) => r.userId),
      },
    );
    if (drafts.length === 0) return 0;
    const result = await tx.notification.createMany({
      data: drafts.map((d) => ({
        userId: d.userId,
        type: event.type,
        actorId: event.actorId,
        mutantId: mutant.id,
        projectId: mutant.projectId,
        title: d.title,
        body: d.body,
      })),
    });
    return result.count;
  },

  /** Direct fan-out for events that are not tied to one mutant (e.g. bulk imports). */
  createMany(
    rows: Array<{
      userId: string;
      type: ActivityType;
      actorId: string | null;
      mutantId: number | null;
      projectId: string | null;
      title: string;
      body: string | null;
    }>,
  ) {
    return prisma.notification.createMany({ data: rows });
  },

  list(userId: string, opts: { unreadOnly?: boolean; take?: number; skip?: number } = {}) {
    return prisma.notification.findMany({
      where: { userId, readAt: opts.unreadOnly ? null : undefined },
      include: notificationInclude,
      orderBy: { createdAt: "desc" },
      take: opts.take ?? 20,
      skip: opts.skip ?? 0,
    });
  },

  count(userId: string, opts: { unreadOnly?: boolean } = {}) {
    return prisma.notification.count({
      where: { userId, readAt: opts.unreadOnly ? null : undefined },
    });
  },

  findOwned(id: string, userId: string) {
    return prisma.notification.findFirst({ where: { id, userId }, include: notificationInclude });
  },

  markRead(userId: string, ids: string[]) {
    return prisma.notification.updateMany({
      where: { userId, id: { in: ids }, readAt: null },
      data: { readAt: new Date() },
    });
  },

  markAllRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  },
};
