import "server-only";
import type { CurrentUser } from "@/server/auth/session";
import { canAccessReviewQueue } from "@/domain/auth/permissions";
import { activityRepository } from "@/server/repositories/interaction-repository";
import { mutantRepository } from "@/server/repositories/mutant-repository";
import { projectRepository } from "@/server/repositories/project-repository";
import { statsRepository } from "@/server/repositories/stats-repository";
import { reviewService } from "./review-service";

export const dashboardService = {
  async getDashboard(user: CurrentUser) {
    const isReviewer = canAccessReviewQueue(user);
    const [submissions, pendingReviews, activity, followed, suggested, reviewQueueCount, counts] =
      await Promise.all([
        mutantRepository.list({ createdById: user.id }, { page: 1, pageSize: 8 }),
        mutantRepository.list(
          { createdById: user.id, reviewStatusIn: ["PENDING", "NEEDS_INFORMATION"] },
          { page: 1, pageSize: 5 },
        ),
        activityRepository.listRelevantForUser(user.id, 12),
        projectRepository.listFollowedByUser(user.id),
        mutantRepository.suggestedForReproduction(user.id, 5),
        isReviewer ? reviewService.countQueue(user) : Promise.resolve(0),
        statsRepository.countsForUser(user.id),
      ]);
    return {
      isReviewer,
      reviewQueueCount,
      submissions: submissions.items,
      totalSubmissions: submissions.total,
      pendingReviews: pendingReviews.items,
      activity,
      followedProjects: followed.map((f) => f.project),
      suggested,
      counts,
    };
  },

  async getPublicActivity(take = 20) {
    return activityRepository.listRecent({ take });
  },
};
