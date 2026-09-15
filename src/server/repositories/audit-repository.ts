import "server-only";
import { prisma } from "@/server/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { AuditAction } from "@/generated/prisma/enums";
import { userSummarySelect } from "./user-repository";

export interface AuditEntryInput {
  actorId: string | null;
  action: AuditAction;
  projectId?: string | null;
  targetType: "project" | "member" | "mutant";
  targetId: string;
  metadata?: Prisma.InputJsonValue;
}

export const auditInclude = {
  actor: { select: userSummarySelect },
} satisfies Prisma.AuditLogInclude;
export type AuditEntry = Prisma.AuditLogGetPayload<{ include: typeof auditInclude }>;

/** Append-only log of privileged actions. Failures here never block the action itself. */
export const auditRepository = {
  async record(entry: AuditEntryInput): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          actorId: entry.actorId,
          action: entry.action,
          projectId: entry.projectId ?? null,
          targetType: entry.targetType,
          targetId: entry.targetId,
          metadata: entry.metadata,
        },
      });
    } catch (error) {
      console.error("[audit] failed to record", entry.action, error);
    }
  },

  listForProject(projectId: string, take = 20) {
    return prisma.auditLog.findMany({
      where: { projectId },
      include: auditInclude,
      orderBy: { createdAt: "desc" },
      take,
    });
  },
};
