import "server-only";
import { prisma } from "@/server/db/prisma";
import type { Prisma } from "@/generated/prisma/client";

export interface GitHubIdentity {
  githubId: string;
  githubUsername: string;
  displayName: string;
  avatarUrl: string | null;
  email: string | null;
}

export const userSummarySelect = {
  id: true,
  githubUsername: true,
  displayName: true,
  avatarUrl: true,
  globalRole: true,
} satisfies Prisma.UserSelect;

export type UserSummary = Prisma.UserGetPayload<{ select: typeof userSummarySelect }>;

export const userRepository = {
  findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  findByUsername(githubUsername: string) {
    return prisma.user.findUnique({ where: { githubUsername } });
  },

  /** Identity + memberships in a single query, used to build the Principal. */
  findPrincipalById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        ...userSummarySelect,
        email: true,
        memberships: { select: { projectId: true, role: true } },
      },
    });
  },

  /** Creates or refreshes a user from a GitHub OAuth profile. */
  async upsertFromGitHub(identity: GitHubIdentity) {
    const existing = await prisma.user.findUnique({ where: { githubId: identity.githubId } });
    if (existing) {
      return prisma.user.update({
        where: { id: existing.id },
        data: {
          githubUsername: identity.githubUsername,
          displayName: identity.displayName,
          avatarUrl: identity.avatarUrl,
          email: identity.email ?? existing.email,
        },
      });
    }
    // A seed user may exist with the same username but no GitHub id: claim it.
    const byUsername = await prisma.user.findUnique({
      where: { githubUsername: identity.githubUsername },
    });
    if (byUsername && !byUsername.githubId) {
      return prisma.user.update({
        where: { id: byUsername.id },
        data: {
          githubId: identity.githubId,
          displayName: identity.displayName,
          avatarUrl: identity.avatarUrl,
          email: identity.email ?? byUsername.email,
        },
      });
    }
    return prisma.user.create({
      data: {
        githubId: identity.githubId,
        githubUsername: identity.githubUsername,
        displayName: identity.displayName,
        avatarUrl: identity.avatarUrl,
        email: identity.email,
      },
    });
  },

  /**
   * Finds a user by username or creates a placeholder account for it. Used by
   * the mocked login and by maintainers adding members who have not signed in
   * yet; the placeholder is claimed on the user's first GitHub sign-in.
   */
  async findOrCreateByUsername(githubUsername: string) {
    const existing = await prisma.user.findUnique({ where: { githubUsername } });
    if (existing) return existing;
    return prisma.user.create({
      data: {
        githubUsername,
        displayName: githubUsername,
        avatarUrl: `https://avatars.githubusercontent.com/${encodeURIComponent(githubUsername)}`,
      },
    });
  },

  /** Grants the global ADMIN role (idempotent). */
  async promoteToAdmin(userId: string) {
    return prisma.user.update({ where: { id: userId }, data: { globalRole: "ADMIN" } });
  },

  /** Dev-only alias kept for the mocked login. */
  findOrCreateMockUser(githubUsername: string) {
    return this.findOrCreateByUsername(githubUsername);
  },

  listMockLoginUsers() {
    return prisma.user.findMany({
      select: {
        ...userSummarySelect,
        memberships: { select: { role: true, project: { select: { displayName: true } } } },
      },
      orderBy: { createdAt: "asc" },
      take: 50,
    });
  },

  searchByUsername(query: string, take = 10) {
    return prisma.user.findMany({
      where: {
        OR: [
          { githubUsername: { contains: query, mode: "insensitive" } },
          { displayName: { contains: query, mode: "insensitive" } },
        ],
      },
      select: userSummarySelect,
      take,
    });
  },
};
