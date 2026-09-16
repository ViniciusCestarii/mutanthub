import "server-only";
import { prisma } from "@/server/db/prisma";
import type { DriftStatus } from "@/generated/prisma/enums";
import { DRIFT_MUTATION_STATUSES, DRIFT_REVIEW_STATUSES } from "@/domain/drift/status";

export interface DriftCounts {
  unchecked: number;
  applies: number;
  moved: number;
  gone: number;
}

export const driftRepository = {
  /** Open mutants (pending or approved, not yet killed/classified) to check against HEAD. */
  listOpenForProject(projectId: string) {
    return prisma.mutant.findMany({
      where: {
        projectId,
        reviewStatus: { in: [...DRIFT_REVIEW_STATUSES] },
        mutationStatus: { in: [...DRIFT_MUTATION_STATUSES] },
      },
      select: {
        id: true,
        title: true,
        filePath: true,
        startLine: true,
        originalCode: true,
        driftStatus: true,
        driftCommitSha: true,
        createdById: true,
      },
      orderBy: [{ filePath: "asc" }, { startLine: "asc" }],
    });
  },

  updateResult(
    id: number,
    result: {
      driftStatus: DriftStatus;
      driftLine: number | null;
      driftCommitSha: string;
      driftCheckedAt: Date;
    },
  ) {
    return prisma.mutant.update({ where: { id }, data: result, select: { id: true } });
  },

  markProjectChecked(projectId: string, commitSha: string, at: Date) {
    return prisma.project.update({
      where: { id: projectId },
      data: { driftCommitSha: commitSha, driftCheckedAt: at },
      select: { id: true },
    });
  },

  async countsForProject(projectId: string): Promise<DriftCounts> {
    const groups = await prisma.mutant.groupBy({
      by: ["driftStatus"],
      where: {
        projectId,
        reviewStatus: { in: [...DRIFT_REVIEW_STATUSES] },
        mutationStatus: { in: [...DRIFT_MUTATION_STATUSES] },
      },
      _count: { _all: true },
    });
    const counts: DriftCounts = { unchecked: 0, applies: 0, moved: 0, gone: 0 };
    for (const g of groups) {
      const key = g.driftStatus.toLowerCase() as keyof DriftCounts;
      counts[key] = g._count._all;
    }
    return counts;
  },
};
