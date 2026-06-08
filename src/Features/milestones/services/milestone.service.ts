import { ProgressTrackingService } from "../../progress/services/progressTracking.service";
import {
  MILESTONE_DEFINITIONS,
  MILESTONE_TIER_ORDER,
} from "../definitions/milestone.definitions";

export class MilestoneService {
  static async listForUser(userId: string, organizationId: string) {
    const progress = await ProgressTrackingService.getOrCreate(
      userId,
      organizationId
    );

    const milestones = MILESTONE_DEFINITIONS.map((def) => {
      const current = def.getCurrent(progress);
      const complete = def.isComplete(progress);
      const progressPercent = Math.min(
        100,
        def.target > 0 ? Math.round((current / def.target) * 100) : 0
      );

      return {
        id: def.id,
        tier: def.tier,
        title: def.title,
        description: def.description,
        icon: def.icon,
        target: def.target,
        current,
        progressPercent: complete ? 100 : progressPercent,
        complete,
      };
    });

    const completedCount = milestones.filter((m) => m.complete).length;
    const tierProgress = MILESTONE_TIER_ORDER.map((tier) => {
      const inTier = milestones.filter((m) => m.tier === tier);
      const done = inTier.filter((m) => m.complete).length;
      return {
        tier,
        total: inTier.length,
        completed: done,
        percent: inTier.length > 0 ? Math.round((done / inTier.length) * 100) : 0,
      };
    });

    const nextMilestone =
      milestones.find((m) => !m.complete) ?? milestones[milestones.length - 1];

    return {
      milestones,
      summary: {
        completed: completedCount,
        total: milestones.length,
        overallPercent: Math.round((completedCount / milestones.length) * 100),
        tierProgress,
        nextMilestone: nextMilestone
          ? {
              id: nextMilestone.id,
              title: nextMilestone.title,
              progressPercent: nextMilestone.progressPercent,
            }
          : null,
      },
      stats: {
        totalXp: progress.totalXp,
        lessonsCompleted: progress.lessonsCompleted,
        quizzesTaken: progress.quizzesTaken,
        currentStreak: progress.currentStreak,
        flashcardsReviewed: progress.flashcardsReviewed,
      },
    };
  }
}
