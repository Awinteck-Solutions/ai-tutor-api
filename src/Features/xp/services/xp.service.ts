import mongoose from "mongoose";
import { NotificationType } from "../../../shared/enums/notificationType.enum";
import { XpSourceType } from "../../../shared/enums/xpSourceType.enum";
import { NotificationService } from "../../notification/services/notification.service";
import { ProgressTrackingService } from "../../progress/services/progressTracking.service";
import User from "../../auth/models/user.model";
import { AchievementService } from "../../achievements/services/achievement.service";
import { XP_AMOUNTS } from "../constants/xp.constants";
import XpAward from "../models/xpAward.model";

export interface XpAwardResult {
  awarded: boolean;
  xpAmount: number;
  totalXp: number;
  sourceType: XpSourceType;
  sourceId: string;
}

export class XpService {
  static async tryAward(
    userId: string,
    organizationId: string,
    sourceType: XpSourceType,
    sourceId: string
  ): Promise<XpAwardResult> {
    const xpAmount = XP_AMOUNTS[sourceType];
    const progress = await ProgressTrackingService.getOrCreate(
      userId,
      organizationId
    );

    try {
      await XpAward.create({
        userId,
        organizationId,
        sourceType,
        sourceId: new mongoose.Types.ObjectId(sourceId),
        xpAmount,
      });
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      if (code === 11000) {
        return {
          awarded: false,
          xpAmount: 0,
          totalXp: progress.totalXp ?? 0,
          sourceType,
          sourceId,
        };
      }
      throw err;
    }

    progress.totalXp = (progress.totalXp ?? 0) + xpAmount;
    await progress.save();

    const sourceLabel =
      sourceType === XpSourceType.LESSON
        ? "lesson"
        : sourceType === XpSourceType.QUIZ
          ? "quiz"
          : sourceType === XpSourceType.FLASHCARD_LESSON
            ? "flashcard set"
            : "flashcard";

    await NotificationService.create({
      userId,
      organizationId,
      type: NotificationType.XP_EARNED,
      title: `+${xpAmount} XP`,
      body: `You earned ${xpAmount} XP for completing a ${sourceLabel}.`,
      data: { sourceType, sourceId, xpAmount },
    });

    await AchievementService.checkUnlocks(userId, organizationId);

    return {
      awarded: true,
      xpAmount,
      totalXp: progress.totalXp,
      sourceType,
      sourceId,
    };
  }

  static async getOrgLeaderboard(
    organizationId: string,
    limit = 20
  ) {
    const rows = await ProgressTrackingService.getOrCreateLeaderboardQuery(
      organizationId,
      limit
    );
    return this.formatLeaderboard(rows);
  }

  static async getGlobalLeaderboard(limit = 20) {
    const rows = await ProgressTrackingService.getGlobalLeaderboardQuery(limit);
    return this.formatLeaderboard(rows);
  }

  private static async formatLeaderboard(
    rows: {
      userId: mongoose.Types.ObjectId;
      totalXp: number;
      lessonsCompleted?: number;
      currentStreak?: number;
    }[]
  ) {
    const userIds = rows.map((r) => r.userId);
    const users = await User.find({ _id: { $in: userIds } }).select(
      "firstName lastName email"
    );
    type LeaderboardUser = { _id: mongoose.Types.ObjectId; firstName: string; lastName: string };
    const userMap = new Map(
      (users as LeaderboardUser[]).map((u) => [u._id.toString(), u])
    );

    return rows.map((row, index) => {
      const u = userMap.get(row.userId.toString());
      return {
        rank: index + 1,
        userId: row.userId.toString(),
        name: u ? `${u.firstName} ${u.lastName}`.trim() : "Student",
        totalXp: row.totalXp ?? 0,
        lessonsCompleted: row.lessonsCompleted ?? 0,
        currentStreak: row.currentStreak ?? 0,
      };
    });
  }

  static async getUserRank(
    userId: string,
    organizationId: string,
    scope: "organization" | "global"
  ): Promise<{ rank: number; totalXp: number }> {
    const progress = await ProgressTrackingService.getOrCreate(
      userId,
      organizationId
    );
    const totalXp = progress.totalXp ?? 0;

    if (scope === "organization") {
      const ahead = await ProgressTrackingService.countAheadInOrg(
        organizationId,
        totalXp,
        userId
      );
      return { rank: ahead + 1, totalXp };
    }

    const ahead = await ProgressTrackingService.countAheadGlobal(
      totalXp,
      userId
    );
    return { rank: ahead + 1, totalXp };
  }
}
