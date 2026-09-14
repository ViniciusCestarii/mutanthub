import "server-only";
import { notFound } from "@/lib/errors";
import {
  activityRepository,
  validationRepository,
} from "@/server/repositories/interaction-repository";
import { mutantRepository } from "@/server/repositories/mutant-repository";
import { statsRepository } from "@/server/repositories/stats-repository";
import { userRepository } from "@/server/repositories/user-repository";
import { prisma } from "@/server/db/prisma";

export const userService = {
  async getProfile(username: string) {
    const user = await userRepository.findByUsername(username);
    if (!user) throw notFound("User");
    const [counts, validationsPerformed, recentMutants, recentActivity, memberships] =
      await Promise.all([
        statsRepository.countsForUser(user.id),
        validationRepository.countByUser(user.id),
        mutantRepository.list({ createdById: user.id }, { page: 1, pageSize: 10 }),
        activityRepository.listRecent({ actorId: user.id, take: 15 }),
        prisma.projectMember.findMany({
          where: { userId: user.id },
          include: {
            project: {
              select: { id: true, githubOwner: true, githubRepository: true, displayName: true },
            },
          },
        }),
      ]);
    return {
      user,
      counts,
      validationsPerformed,
      recentMutants: recentMutants.items,
      totalMutants: recentMutants.total,
      recentActivity,
      memberships,
    };
  },
};
