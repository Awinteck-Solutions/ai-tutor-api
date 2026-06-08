import { Role } from "../../../shared/enums/roles.enum";
import { Status } from "../../../shared/enums/status.enum";
import { ProcessingStatus } from "../../../shared/enums/processingStatus.enum";
import { AppError } from "../../../shared/errors/AppError";
import { JwtPayload } from "../../../types/express.d";
import { AccessControlService } from "../../../shared/services/accessControl.service";
import User from "../../auth/models/user.model";
import Material from "../../material/models/material.model";
import Lesson from "../../lesson/models/lesson.model";
import LessonProgress from "../../progress/models/lessonProgress.model";
import QuizAttempt from "../../progress/models/quizAttempt.model";
import FlashcardProgress from "../../progress/models/flashcardProgress.model";
import AIUsageLog from "../../usage/models/aiUsageLog.model";
import Organization from "../../organization/models/organization.model";
import { ProgressService } from "../../progress/services/progress.service";

export class AnalyticsService {
  static async studentDashboard(
    user: JwtPayload,
    organizationId: string,
    studentId?: string
  ) {
    const targetId = studentId ?? user.sub;
    if (targetId !== user.sub) {
      await AccessControlService.canAccessStudentData(user, targetId, organizationId);
    }
    return ProgressService.getDashboard(user, organizationId, targetId);
  }

  static async teacherAnalytics(user: JwtPayload, organizationId: string) {
    await AccessControlService.assertOrgManage(user, organizationId);

    const [students, lessonStats, quizStats, weakLessons] = await Promise.all([
      User.countDocuments({ organizationId, role: Role.STUDENT, status: Status.ACTIVE }),
      LessonProgress.aggregate([
        { $match: { organizationId: organizationId as unknown as import("mongoose").Types.ObjectId } },
        {
          $group: {
            _id: "$lessonId",
            avgProgress: { $avg: "$progressPercent" },
            count: { $sum: 1 },
          },
        },
        { $sort: { avgProgress: 1 } },
        { $limit: 5 },
      ]),
      QuizAttempt.aggregate([
        { $match: { organizationId: organizationId as unknown as import("mongoose").Types.ObjectId } },
        {
          $group: {
            _id: null,
            avgScore: { $avg: "$score" },
            attempts: { $sum: 1 },
          },
        },
      ]),
      LessonProgress.aggregate([
        { $match: { organizationId: organizationId as unknown as import("mongoose").Types.ObjectId } },
        { $match: { progressPercent: { $lt: 50 } } },
        { $group: { _id: "$userId", strugglingCount: { $sum: 1 } } },
        { $sort: { strugglingCount: -1 } },
        { $limit: 10 },
      ]),
    ]);

    return {
      activeStudents: students,
      difficultLessons: lessonStats,
      quizPerformance: quizStats[0] ?? { avgScore: 0, attempts: 0 },
      strugglingStudents: weakLessons,
    };
  }

  static async organizationAnalytics(user: JwtPayload, organizationId: string) {
    await AccessControlService.assertAdmin(user, organizationId);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const org = await Organization.findById(organizationId);
    if (!org) throw new AppError("Organization not found", 404);

    const [activeStudents, materials, completedLessons, aiUsage] = await Promise.all([
      User.countDocuments({ organizationId, role: Role.STUDENT, status: Status.ACTIVE }),
      Material.countDocuments({ organizationId, status: Status.ACTIVE }),
      Lesson.countDocuments({ organizationId, generationStatus: ProcessingStatus.COMPLETED }),
      AIUsageLog.aggregate([
        { $match: { organizationId: org._id, createdAt: { $gte: startOfMonth } } },
        {
          $group: {
            _id: null,
            requests: { $sum: "$requestCount" },
            tokens: { $sum: "$tokensUsed" },
          },
        },
      ]),
    ]);

    return {
      activeStudents,
      uploadedMaterials: materials,
      completedLessons,
      aiUsageThisMonth: aiUsage[0] ?? { requests: 0, tokens: 0 },
      subscriptionPlan: org.subscriptionPlan,
    };
  }

  static async flashcardRetention(
    userId: string,
    organizationId: string,
    requester?: JwtPayload
  ) {
    if (requester) {
      await AccessControlService.canAccessStudentData(
        requester,
        userId,
        organizationId
      );
    }

    const stats = await FlashcardProgress.aggregate([
      { $match: { userId: userId as unknown as import("mongoose").Types.ObjectId, organizationId: organizationId as unknown as import("mongoose").Types.ObjectId } },
      {
        $group: {
          _id: null,
          avgConfidence: { $avg: "$confidenceScore" },
          avgMastery: { $avg: "$masteryLevel" },
          dueNow: {
            $sum: {
              $cond: [{ $lte: ["$nextReviewAt", new Date()] }, 1, 0],
            },
          },
          total: { $sum: 1 },
        },
      },
    ]);

    return stats[0] ?? { avgConfidence: 0, avgMastery: 0, dueNow: 0, total: 0 };
  }
}
