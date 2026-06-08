import { NotificationType } from "../../../shared/enums/notificationType.enum";
import { NotificationService } from "../../notification/services/notification.service";
import { ProgressTrackingService } from "../../progress/services/progressTracking.service";
import UserAchievement from "../models/userAchievement.model";
import { ACHIEVEMENT_DEFINITIONS } from "../definitions/achievement.definitions";

export class AchievementService {
  static async checkUnlocks(
    userId: string,
    organizationId: string
  ): Promise<{ unlocked: { id: string; title: string }[] }> {
    const progress = await ProgressTrackingService.getOrCreate(
      userId,
      organizationId
    );

    const existing = await UserAchievement.find({
      userId,
      organizationId,
    }).select("achievementId");
    const existingIds = new Set(existing.map((a) => a.achievementId));

    const newlyUnlocked: { id: string; title: string }[] = [];

    for (const def of ACHIEVEMENT_DEFINITIONS) {
      if (existingIds.has(def.id)) continue;
      if (!def.isUnlocked(progress)) continue;

      await UserAchievement.create({
        userId,
        organizationId,
        achievementId: def.id,
        title: def.title,
        unlockedAt: new Date(),
      });

      await NotificationService.create({
        userId,
        organizationId,
        type: NotificationType.ACHIEVEMENT_UNLOCKED,
        title: "Achievement unlocked",
        body: `You earned "${def.title}" — ${def.description}`,
        data: { achievementId: def.id, achievementTitle: def.title },
      });

      newlyUnlocked.push({ id: def.id, title: def.title });
    }

    return { unlocked: newlyUnlocked };
  }

  static async listForUser(userId: string, organizationId: string) {
    const progress = await ProgressTrackingService.getOrCreate(
      userId,
      organizationId
    );

    const unlocked = await UserAchievement.find({ userId, organizationId })
      .sort({ unlockedAt: -1 })
      .lean();

    const unlockedIds = new Set(unlocked.map((a) => a.achievementId));

    const achievements = ACHIEVEMENT_DEFINITIONS.map((def) => ({
      id: def.id,
      title: def.title,
      description: def.description,
      unlocked: unlockedIds.has(def.id),
      unlockedAt: unlocked.find((u) => u.achievementId === def.id)?.unlockedAt,
    }));

    return { achievements, stats: progress };
  }
}
