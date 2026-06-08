import mongoose from "mongoose";
import { SubscriptionPlan } from "../enums/subscriptionPlan.enum";
import { Status } from "../enums/status.enum";
import { AppError } from "../errors/AppError";
import {
  STUDENT_FREE_LIMITS,
  STUDENT_PLAN_CATALOG,
} from "../constants/studentPlanLimits.constants";
import Organization from "../../Features/organization/models/organization.model";
import Material from "../../Features/material/models/material.model";
import Lesson from "../../Features/lesson/models/lesson.model";
import FlashcardSet from "../../Features/flashcard/models/flashcardSet.model";
import Quiz from "../../Features/quiz/models/quiz.model";
import ChatSession from "../../Features/chat/models/chatSession.model";
import { ChatMessageRole } from "../enums/chat.enum";
import AIUsageLog from "../../Features/usage/models/aiUsageLog.model";
import { UsageLimitService } from "./usageLimit.service";

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const startOfMonth = () => {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
};

export class StudentPlanLimitService {
  static getFreeLimits() {
    return { ...STUDENT_FREE_LIMITS };
  }

  static async shouldApplyFreeLimits(organizationId: string): Promise<boolean> {
    const org = await Organization.findById(organizationId).select(
      "isPersonalWorkspace subscriptionPlan"
    );
    if (!org) return false;
    return (
      Boolean(org.isPersonalWorkspace) ||
      org.subscriptionPlan === SubscriptionPlan.FREE
    );
  }

  static async getUsageSnapshot(organizationId: string, userId: string) {
    const limits = STUDENT_FREE_LIMITS;
    const orgOid = new mongoose.Types.ObjectId(organizationId);
    const userOid = new mongoose.Types.ObjectId(userId);
    const today = startOfToday();
    const monthStart = startOfMonth();

    const [
      storage,
      lessonsToday,
      materialsToday,
      chatToday,
      practiceToday,
      totalMaterials,
      totalLessons,
      aiMonth,
      org,
      applyFree,
    ] = await Promise.all([
      UsageLimitService.getStorageUsage(organizationId),
      Lesson.countDocuments({
        organizationId: orgOid,
        createdBy: userOid,
        isPersonal: true,
        createdAt: { $gte: today },
      }),
      Material.countDocuments({
        organizationId: orgOid,
        uploadedBy: userOid,
        status: { $ne: Status.DELETED },
        createdAt: { $gte: today },
      }),
      ChatSession.aggregate([
        { $match: { organizationId: orgOid, userId: userOid } },
        {
          $lookup: {
            from: "chatmessages",
            localField: "_id",
            foreignField: "sessionId",
            as: "messages",
          },
        },
        { $unwind: "$messages" },
        {
          $match: {
            "messages.role": ChatMessageRole.USER,
            "messages.createdAt": { $gte: today },
          },
        },
        { $count: "total" },
      ]).then((rows) => rows[0]?.total ?? 0),
      this.countPracticeGenerationsToday(orgOid, userOid, today),
      Material.countDocuments({
        organizationId: orgOid,
        uploadedBy: userOid,
        status: { $ne: Status.DELETED },
      }),
      Lesson.countDocuments({
        organizationId: orgOid,
        createdBy: userOid,
        isPersonal: true,
        status: { $ne: Status.DELETED },
      }),
      AIUsageLog.aggregate([
        {
          $match: {
            organizationId: orgOid,
            createdAt: { $gte: monthStart },
          },
        },
        {
          $group: {
            _id: null,
            requests: { $sum: "$requestCount" },
            tokens: { $sum: "$tokensUsed" },
          },
        },
      ]),
      Organization.findById(organizationId).select(
        "subscriptionPlan isPersonalWorkspace name"
      ),
      this.shouldApplyFreeLimits(organizationId),
    ]);

    const ai = aiMonth[0] ?? { requests: 0, tokens: 0 };

    return {
      plan: org?.subscriptionPlan ?? SubscriptionPlan.FREE,
      isPersonalWorkspace: Boolean(org?.isPersonalWorkspace),
      applyFreeLimits: applyFree,
      limits: applyFree ? limits : null,
      usage: {
        storageBytes: storage.totalBytes,
        storageMegabytes: storage.totalMegabytes,
        lessonsToday,
        materialsToday,
        chatMessagesToday: chatToday,
        practiceGenerationsToday: practiceToday,
        totalMaterials,
        totalPersonalLessons: totalLessons,
        monthlyAiRequests: ai.requests,
        monthlyAiTokens: ai.tokens,
      },
      packages: STUDENT_PLAN_CATALOG,
      billingReady: false,
    };
  }

  private static async countPracticeGenerationsToday(
    orgOid: mongoose.Types.ObjectId,
    userOid: mongoose.Types.ObjectId,
    today: Date
  ): Promise<number> {
    const personalLessonIds = await Lesson.find({
      organizationId: orgOid,
      createdBy: userOid,
      isPersonal: true,
    }).distinct("_id");

    if (!personalLessonIds.length) return 0;

    const [flashcardSets, quizzes] = await Promise.all([
      FlashcardSet.countDocuments({
        organizationId: orgOid,
        lessonId: { $in: personalLessonIds },
        createdAt: { $gte: today },
      }),
      Quiz.countDocuments({
        organizationId: orgOid,
        lessonId: { $in: personalLessonIds },
        createdAt: { $gte: today },
      }),
    ]);

    return flashcardSets + quizzes;
  }

  static async assertLessonCreation(
    organizationId: string,
    userId: string
  ): Promise<void> {
    const apply = await this.shouldApplyFreeLimits(organizationId);
    if (!apply) {
      await UsageLimitService.assertWithinLimits(organizationId);
      return;
    }

    const snapshot = await this.getUsageSnapshot(organizationId, userId);
    const { usage } = snapshot;
    const limits = STUDENT_FREE_LIMITS;

    if (usage.lessonsToday >= limits.lessonsPerDay) {
      throw new AppError(
        `Daily lesson limit reached (${limits.lessonsPerDay} per day on Free). Upgrade coming soon.`,
        429
      );
    }
    if (usage.totalPersonalLessons >= limits.maxPersonalLessonsTotal) {
      throw new AppError(
        `Personal lesson limit reached (${limits.maxPersonalLessonsTotal} total on Free).`,
        429
      );
    }
    if (usage.monthlyAiRequests >= limits.monthlyAiRequests) {
      throw new AppError("Monthly AI request limit reached for Free plan", 429);
    }
  }

  static async assertMaterialUpload(
    organizationId: string,
    userId: string,
    additionalBytes = 0
  ): Promise<void> {
    const apply = await this.shouldApplyFreeLimits(organizationId);
    if (!apply) return;

    const snapshot = await this.getUsageSnapshot(organizationId, userId);
    const { usage } = snapshot;
    const limits = STUDENT_FREE_LIMITS;

    if (usage.materialsToday >= limits.materialsPerDay) {
      throw new AppError(
        `Daily upload limit reached (${limits.materialsPerDay} per day on Free).`,
        429
      );
    }
    if (usage.totalMaterials >= limits.maxMaterialsTotal) {
      throw new AppError(
        `Material limit reached (${limits.maxMaterialsTotal} total on Free).`,
        429
      );
    }
    const nextBytes = usage.storageBytes + additionalBytes;
    if (nextBytes > limits.storageBytes) {
      throw new AppError(
        `Storage limit reached (${Math.round(limits.storageBytes / (1024 * 1024))} MB on Free). Delete old uploads or upgrade when available.`,
        429
      );
    }
  }

  static async assertChatMessage(
    organizationId: string,
    userId: string
  ): Promise<void> {
    const apply = await this.shouldApplyFreeLimits(organizationId);
    if (!apply) {
      await UsageLimitService.assertWithinLimits(organizationId);
      return;
    }

    const snapshot = await this.getUsageSnapshot(organizationId, userId);
    if (snapshot.usage.chatMessagesToday >= STUDENT_FREE_LIMITS.chatMessagesPerDay) {
      throw new AppError(
        `Daily chat limit reached (${STUDENT_FREE_LIMITS.chatMessagesPerDay} messages on Free).`,
        429
      );
    }
    if (snapshot.usage.monthlyAiRequests >= STUDENT_FREE_LIMITS.monthlyAiRequests) {
      throw new AppError("Monthly AI request limit reached for Free plan", 429);
    }
  }

  static async assertPracticeGeneration(
    organizationId: string,
    userId: string
  ): Promise<void> {
    const apply = await this.shouldApplyFreeLimits(organizationId);
    if (!apply) {
      await UsageLimitService.assertWithinLimits(organizationId);
      return;
    }

    const snapshot = await this.getUsageSnapshot(organizationId, userId);
    if (
      snapshot.usage.practiceGenerationsToday >=
      STUDENT_FREE_LIMITS.practiceGenerationsPerDay
    ) {
      throw new AppError(
        `Daily quiz & flashcard generation limit reached (${STUDENT_FREE_LIMITS.practiceGenerationsPerDay} on Free).`,
        429
      );
    }
  }
}
