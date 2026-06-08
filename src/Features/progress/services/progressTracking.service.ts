import StudentProgress from "../models/studentProgress.model";

export class ProgressTrackingService {
  static async getOrCreate(
    userId: string,
    organizationId: string
  ): Promise<InstanceType<typeof StudentProgress>> {
    let progress = await StudentProgress.findOne({ userId, organizationId });
    if (!progress) {
      progress = await StudentProgress.create({ userId, organizationId });
    }
    return progress;
  }

  static async recordStudyActivity(
    userId: string,
    organizationId: string,
    minutesSpent = 0
  ): Promise<void> {
    const progress = await this.getOrCreate(userId, organizationId);
    const today = this.startOfDay(new Date());
    const lastStudy = progress.lastStudyDate
      ? this.startOfDay(progress.lastStudyDate)
      : null;

    if (minutesSpent > 0) {
      progress.totalStudyTimeMinutes += minutesSpent;
    }

    if (!lastStudy) {
      progress.currentStreak = 1;
    } else {
      const diffDays = Math.floor(
        (today.getTime() - lastStudy.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays === 0) {
        // same day — streak unchanged
      } else if (diffDays === 1) {
        progress.currentStreak += 1;
      } else {
        progress.currentStreak = 1;
      }
    }

    if (progress.currentStreak > progress.longestStreak) {
      progress.longestStreak = progress.currentStreak;
    }

    progress.lastStudyDate = new Date();
    await progress.save();
  }

  static async addWeakTopics(
    userId: string,
    organizationId: string,
    topics: string[]
  ): Promise<void> {
    if (topics.length === 0) return;

    const progress = await this.getOrCreate(userId, organizationId);
    const merged = new Set([...progress.weakTopics, ...topics]);
    progress.weakTopics = Array.from(merged).slice(-20);
    await progress.save();
  }

  static async getOrgLeaderboardQuery(organizationId: string, limit: number) {
    return StudentProgress.find({ organizationId, totalXp: { $gt: 0 } })
      .sort({ totalXp: -1, lessonsCompleted: -1 })
      .limit(limit)
      .select("userId totalXp lessonsCompleted currentStreak")
      .lean();
  }

  static async getGlobalLeaderboardQuery(limit: number) {
    return StudentProgress.aggregate([
      { $match: { totalXp: { $gt: 0 } } },
      {
        $group: {
          _id: "$userId",
          totalXp: { $sum: "$totalXp" },
          lessonsCompleted: { $sum: "$lessonsCompleted" },
          currentStreak: { $max: "$currentStreak" },
        },
      },
      { $sort: { totalXp: -1 } },
      { $limit: limit },
      {
        $project: {
          userId: "$_id",
          totalXp: 1,
          lessonsCompleted: 1,
          currentStreak: 1,
        },
      },
    ]);
  }

  static async countAheadInOrg(
    organizationId: string,
    totalXp: number,
    _userId: string
  ): Promise<number> {
    return StudentProgress.countDocuments({
      organizationId,
      totalXp: { $gt: totalXp },
    });
  }

  static async countAheadGlobal(
    totalXp: number,
    _userId: string
  ): Promise<number> {
    const results = await StudentProgress.aggregate([
      { $match: { totalXp: { $gt: 0 } } },
      {
        $group: {
          _id: "$userId",
          totalXp: { $sum: "$totalXp" },
        },
      },
      { $match: { totalXp: { $gt: totalXp } } },
      { $count: "count" },
    ]);
    return results[0]?.count ?? 0;
  }

  /** @deprecated use getOrgLeaderboardQuery — kept for XpService compat */
  static getOrCreateLeaderboardQuery = this.getOrgLeaderboardQuery;

  private static startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }
}
