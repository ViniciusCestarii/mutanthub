import "server-only";
import { prisma } from "@/server/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { userSummarySelect } from "./user-repository";

export const snapshotSummarySelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  filters: true,
  rowCount: true,
  contentHash: true,
  createdAt: true,
  createdBy: { select: userSummarySelect },
} satisfies Prisma.DatasetSnapshotSelect;

export type SnapshotSummary = Prisma.DatasetSnapshotGetPayload<{
  select: typeof snapshotSummarySelect;
}>;

export const datasetRepository = {
  list(take = 50) {
    return prisma.datasetSnapshot.findMany({
      select: snapshotSummarySelect,
      orderBy: { createdAt: "desc" },
      take,
    });
  },

  findBySlug(slug: string) {
    return prisma.datasetSnapshot.findUnique({ where: { slug }, select: snapshotSummarySelect });
  },

  /** The frozen rows; large, so fetched only when serving a download. */
  findDataBySlug(slug: string) {
    return prisma.datasetSnapshot.findUnique({
      where: { slug },
      select: { slug: true, name: true, rowCount: true, contentHash: true, data: true },
    });
  },

  create(data: {
    slug: string;
    name: string;
    description: string | null;
    filters: Prisma.InputJsonValue;
    rowCount: number;
    contentHash: string;
    data: Prisma.InputJsonValue;
    createdById: string;
  }) {
    return prisma.datasetSnapshot.create({ data, select: snapshotSummarySelect });
  },
};
