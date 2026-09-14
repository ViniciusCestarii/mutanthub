import "server-only";
import { prisma } from "@/server/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { ProjectRole } from "@/generated/prisma/enums";

export const projectSummarySelect = {
  id: true,
  githubOwner: true,
  githubRepository: true,
  displayName: true,
  description: true,
  defaultBranch: true,
  language: true,
  isActive: true,
  createdAt: true,
} satisfies Prisma.ProjectSelect;

export type ProjectSummary = Prisma.ProjectGetPayload<{ select: typeof projectSummarySelect }>;

export interface CreateProjectData {
  githubOwner: string;
  githubRepository: string;
  githubRepositoryId: string | null;
  displayName: string;
  description: string | null;
  defaultBranch: string;
  language: string | null;
  addedById: string | null;
}

export interface UpsertRevisionData {
  projectId: string;
  commitSha: string;
  branch?: string | null;
  commitMessage?: string | null;
  author?: string | null;
  commitDate?: Date | null;
}

export const projectRepository = {
  findBySlug(owner: string, repo: string) {
    return prisma.project.findFirst({
      where: {
        githubOwner: { equals: owner, mode: "insensitive" },
        githubRepository: { equals: repo, mode: "insensitive" },
      },
    });
  },

  findById(id: string) {
    return prisma.project.findUnique({ where: { id } });
  },

  list(opts: { activeOnly?: boolean } = {}) {
    return prisma.project.findMany({
      where: opts.activeOnly ? { isActive: true } : undefined,
      select: {
        ...projectSummarySelect,
        _count: { select: { mutants: true, members: true, followers: true } },
      },
      orderBy: [{ displayName: "asc" }],
    });
  },

  listWithStats(opts: { activeOnly?: boolean } = {}) {
    return prisma.project.findMany({
      where: opts.activeOnly ? { isActive: true } : undefined,
      select: {
        ...projectSummarySelect,
        mutants: { select: { reviewStatus: true, mutationStatus: true } },
        _count: { select: { members: true, followers: true } },
      },
      orderBy: [{ displayName: "asc" }],
    });
  },

  create(data: CreateProjectData) {
    return prisma.project.create({ data });
  },

  async upsertRevision(data: UpsertRevisionData) {
    return prisma.revision.upsert({
      where: { projectId_commitSha: { projectId: data.projectId, commitSha: data.commitSha } },
      create: {
        projectId: data.projectId,
        commitSha: data.commitSha,
        branch: data.branch ?? null,
        commitMessage: data.commitMessage ?? null,
        author: data.author ?? null,
        commitDate: data.commitDate ?? null,
      },
      update: {
        branch: data.branch ?? undefined,
        commitMessage: data.commitMessage ?? undefined,
        author: data.author ?? undefined,
        commitDate: data.commitDate ?? undefined,
      },
    });
  },

  findRevision(projectId: string, commitSha: string) {
    return prisma.revision.findUnique({
      where: { projectId_commitSha: { projectId, commitSha } },
    });
  },

  /** Revisions that have at least one mutant, newest first. */
  listRevisionsWithMutants(projectId: string) {
    return prisma.revision.findMany({
      where: { projectId, mutants: { some: {} } },
      select: {
        id: true,
        commitSha: true,
        branch: true,
        commitDate: true,
        commitMessage: true,
        _count: { select: { mutants: true } },
      },
      orderBy: [{ commitDate: "desc" }, { createdAt: "desc" }],
      take: 20,
    });
  },

  listMembers(projectId: string) {
    return prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: {
          select: { id: true, githubUsername: true, displayName: true, avatarUrl: true },
        },
      },
      orderBy: [{ role: "desc" }, { createdAt: "asc" }],
    });
  },

  upsertMember(projectId: string, userId: string, role: ProjectRole) {
    return prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId } },
      create: { projectId, userId, role },
      update: { role },
    });
  },

  removeMember(projectId: string, userId: string) {
    return prisma.projectMember.deleteMany({ where: { projectId, userId } });
  },

  findMember(projectId: string, userId: string) {
    return prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } } });
  },

  countMaintainers(projectId: string) {
    return prisma.projectMember.count({ where: { projectId, role: "MAINTAINER" } });
  },

  update(
    id: string,
    data: Partial<
      Pick<
        CreateProjectData,
        "displayName" | "description" | "defaultBranch" | "language" | "githubRepositoryId"
      > & { isActive: boolean }
    >,
  ) {
    return prisma.project.update({ where: { id }, data });
  },

  isFollowing(projectId: string, userId: string) {
    return prisma.projectFollow
      .findUnique({ where: { projectId_userId: { projectId, userId } } })
      .then(Boolean);
  },

  follow(projectId: string, userId: string) {
    return prisma.projectFollow.upsert({
      where: { projectId_userId: { projectId, userId } },
      create: { projectId, userId },
      update: {},
    });
  },

  unfollow(projectId: string, userId: string) {
    return prisma.projectFollow.deleteMany({ where: { projectId, userId } });
  },

  listFollowedByUser(userId: string) {
    return prisma.projectFollow.findMany({
      where: { userId },
      include: { project: { select: projectSummarySelect } },
      orderBy: { createdAt: "desc" },
    });
  },

  search(query: string, take = 10) {
    return prisma.project.findMany({
      where: {
        OR: [
          { displayName: { contains: query, mode: "insensitive" } },
          { githubOwner: { contains: query, mode: "insensitive" } },
          { githubRepository: { contains: query, mode: "insensitive" } },
        ],
      },
      select: projectSummarySelect,
      take,
    });
  },
};
