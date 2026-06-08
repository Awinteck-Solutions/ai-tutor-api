import { Role } from "../../../shared/enums/roles.enum";
import { Status } from "../../../shared/enums/status.enum";
import { ProcessingStatus } from "../../../shared/enums/processingStatus.enum";
import { AccessControlService } from "../../../shared/services/accessControl.service";
import { UsageLimitService } from "../../../shared/services/usageLimit.service";
import { JwtPayload } from "../../../types/express.d";
import User from "../../auth/models/user.model";
import Material from "../../material/models/material.model";
import Lesson from "../../lesson/models/lesson.model";
import Subject from "../../academic/models/subject.model";
import Organization from "../../organization/models/organization.model";
import { AnalyticsService } from "../../analytics/services/analytics.service";
import { TeachingOverviewService } from "../../../shared/services/teachingOverview.service";
import { AppError } from "../../../shared/errors/AppError";

export class OrgPortalService {
  static async getDashboard(user: JwtPayload, organizationId: string) {
    await AccessControlService.assertAdmin(user, organizationId);

    const org = await Organization.findById(organizationId);
    if (!org) throw new AppError("Organization not found", 404);

    const [teachers, students, subjects, lessons, materials, analytics, storage] =
      await Promise.all([
        User.countDocuments({
          organizationId,
          role: Role.TEACHER,
          status: Status.ACTIVE,
        }),
        User.countDocuments({
          organizationId,
          role: Role.STUDENT,
          status: Status.ACTIVE,
        }),
        Subject.countDocuments({ organizationId, status: Status.ACTIVE }),
        Lesson.countDocuments({
          organizationId,
          generationStatus: ProcessingStatus.COMPLETED,
          status: Status.ACTIVE,
        }),
        Material.countDocuments({ organizationId, status: Status.ACTIVE }),
        AnalyticsService.organizationAnalytics(user, organizationId),
        UsageLimitService.getStorageUsage(organizationId),
      ]);

    const totalUsers =
      teachers +
      students +
      (await User.countDocuments({
        organizationId,
        role: Role.PARENT,
        status: Status.ACTIVE,
      }));

    const overview = await TeachingOverviewService.build(organizationId);

    return {
      users: totalUsers,
      teachers,
      students,
      subjects,
      lessons,
      materials,
      aiUsage: analytics.aiUsageThisMonth,
      storageUsage: storage,
      subscriptionPlan: org.subscriptionPlan,
      ...overview,
    };
  }

  static async getUsage(user: JwtPayload, organizationId: string) {
    await AccessControlService.assertAdmin(user, organizationId);
    const summary = await UsageLimitService.getUsageSummary(organizationId);

    const embeddingRow = summary.breakdown?.find(
      (r: { _id: string }) => r._id === "embedding"
    );

    const storage = await UsageLimitService.getStorageUsage(organizationId);

    return {
      tokenUsage: summary.usage?.tokens ?? 0,
      embeddingUsage: embeddingRow?.requests ?? 0,
      aiRequests: summary.usage?.requests ?? 0,
      storageUsage: storage,
      limits: summary.limits,
      breakdown: summary.breakdown,
      plan: summary.plan,
    };
  }

  static async getSubscription(user: JwtPayload, organizationId: string) {
    await AccessControlService.assertAdmin(user, organizationId);
    const org = await Organization.findById(organizationId);
    if (!org) throw new AppError("Organization not found", 404);

    const usage = await UsageLimitService.getUsageSummary(organizationId);

    return {
      plan: org.subscriptionPlan,
      status: org.status,
      billingReady: false,
      usage,
      features: {
        aiTutor: true,
        lessonGeneration: true,
        ragChat: true,
        analytics: true,
      },
    };
  }
}
