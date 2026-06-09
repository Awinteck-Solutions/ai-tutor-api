import { Request } from "express";
import mongoose from "mongoose";
import User from "../../auth/models/user.model";
import Organization from "../../organization/models/organization.model";
import AIUsageLog from "../../usage/models/aiUsageLog.model";
import Material from "../../material/models/material.model";
import Lesson from "../../lesson/models/lesson.model";
import { Role } from "../../../shared/enums/roles.enum";
import { Status } from "../../../shared/enums/status.enum";
import { SubscriptionPlan } from "../../../shared/enums/subscriptionPlan.enum";
import { AppError } from "../../../shared/errors/AppError";
import { AuditService } from "../../../shared/services/audit.service";
import { ActivityType } from "../../../shared/enums/activityType.enum";
import {
  buildPaginationMeta,
  parsePagination,
} from "../../../shared/utils/pagination";
import { VisitTrackingService } from "./visitTracking.service";
import { HealthMonitorService } from "./healthMonitor.service";

export class PlatformAdminService {
  static async getStats(days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      activeUsers,
      usersByRole,
      totalOrganizations,
      personalWorkspaces,
      planBreakdown,
      newUsersWeek,
      newOrgsWeek,
      aiUsageMonth,
      aiByOperation,
      contentTotals,
      traffic,
      health,
    ] = await Promise.all([
      User.countDocuments({ status: { $ne: Status.DELETED } }),
      User.countDocuments({ status: Status.ACTIVE }),
      User.aggregate([
        { $match: { status: { $ne: Status.DELETED } } },
        { $group: { _id: "$role", count: { $sum: 1 } } },
      ]),
      Organization.countDocuments({ status: { $ne: Status.DELETED } }),
      Organization.countDocuments({
        status: { $ne: Status.DELETED },
        isPersonalWorkspace: true,
      }),
      Organization.aggregate([
        { $match: { status: { $ne: Status.DELETED } } },
        { $group: { _id: "$subscriptionPlan", count: { $sum: 1 } } },
      ]),
      User.countDocuments({ createdAt: { $gte: since }, status: { $ne: Status.DELETED } }),
      Organization.countDocuments({
        createdAt: { $gte: since },
        status: { $ne: Status.DELETED },
      }),
      AIUsageLog.aggregate([
        { $match: { createdAt: { $gte: startOfMonth } } },
        {
          $group: {
            _id: null,
            requests: { $sum: "$requestCount" },
            tokens: { $sum: "$tokensUsed" },
          },
        },
      ]),
      AIUsageLog.aggregate([
        { $match: { createdAt: { $gte: startOfMonth } } },
        {
          $group: {
            _id: "$operation",
            requests: { $sum: "$requestCount" },
            tokens: { $sum: "$tokensUsed" },
          },
        },
        { $sort: { requests: -1 } },
        { $limit: 10 },
      ]),
      Promise.all([
        Material.countDocuments({ status: Status.ACTIVE }),
        Lesson.countDocuments({ status: Status.ACTIVE }),
      ]),
      VisitTrackingService.geographySummary(days),
      HealthMonitorService.getOverview(24),
    ]);

    const ai = aiUsageMonth[0] ?? { requests: 0, tokens: 0 };

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        newThisPeriod: newUsersWeek,
        byRole: usersByRole.map((r) => ({ role: r._id, count: r.count })),
      },
      organizations: {
        total: totalOrganizations,
        personalWorkspaces,
        newThisPeriod: newOrgsWeek,
        byPlan: planBreakdown.map((p) => ({
          plan: p._id ?? SubscriptionPlan.FREE,
          count: p.count,
        })),
      },
      content: {
        materials: contentTotals[0],
        lessons: contentTotals[1],
      },
      aiUsageThisMonth: {
        requests: ai.requests,
        tokens: ai.tokens,
        byOperation: aiByOperation.map((row) => ({
          operation: row._id,
          requests: row.requests,
          tokens: row.tokens,
        })),
      },
      traffic,
      health: {
        overallStatus: health.overallStatus,
        apiUptimePercent: health.apiUptimePercent,
        processUptimeSeconds: health.processUptimeSeconds,
        components: health.latest,
      },
    };
  }

  static async listUsers(query: {
    page?: number;
    limit?: number;
    search?: string;
    role?: Role;
    status?: Status;
  }) {
    const { page, limit, skip } = parsePagination(query);
    const filter: Record<string, unknown> = { status: { $ne: Status.DELETED } };

    if (query.role) filter.role = query.role;
    if (query.status) filter.status = query.status;
    if (query.search) {
      filter.$or = [
        { email: { $regex: query.search, $options: "i" } },
        { firstName: { $regex: query.search, $options: "i" } },
        { lastName: { $regex: query.search, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("organizationId", "name subscriptionPlan isPersonalWorkspace"),
      User.countDocuments(filter),
    ]);

    return {
      items: items.map((u) => {
        const org = u.organizationId as
          | {
              _id?: mongoose.Types.ObjectId;
              name?: string;
              subscriptionPlan?: SubscriptionPlan;
              isPersonalWorkspace?: boolean;
            }
          | null
          | undefined;
        return {
          id: u._id.toString(),
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          role: u.role,
          status: u.status,
          lastLoginAt: u.lastLoginAt,
          createdAt: u.createdAt,
          organizationId: org?._id?.toString() ?? u.organizationId?.toString(),
          organizationName: org?.name,
          subscriptionPlan: org?.subscriptionPlan,
          isPersonalWorkspace: org?.isPersonalWorkspace,
        };
      }),
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  static async updateUser(
    userId: string,
    input: { role?: Role; status?: Status },
    adminId: string,
    req?: Request
  ) {
    const user = await User.findById(userId);
    if (!user) throw new AppError("User not found", 404);

    if (input.role) user.role = input.role;
    if (input.status) user.status = input.status;
    await user.save();

    await AuditService.log({
      activityType: ActivityType.ROLE_CHANGE,
      description: `Platform admin updated user ${user.email}`,
      organizationId: user.organizationId?.toString(),
      userId: adminId,
      resourceType: "User",
      resourceId: userId,
      metadata: input,
      req,
    });

    return {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      status: user.status,
    };
  }

  static async listOrganizations(query: {
    page?: number;
    limit?: number;
    search?: string;
    plan?: SubscriptionPlan;
  }) {
    const { page, limit, skip } = parsePagination(query);
    const filter: Record<string, unknown> = { status: { $ne: Status.DELETED } };

    if (query.search) {
      filter.name = { $regex: query.search, $options: "i" };
    }
    if (query.plan) filter.subscriptionPlan = query.plan;

    const [items, total] = await Promise.all([
      Organization.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Organization.countDocuments(filter),
    ]);

    const orgIds = items.map((o) => o._id);
    const memberCounts = await User.aggregate([
      { $match: { organizationId: { $in: orgIds }, status: Status.ACTIVE } },
      { $group: { _id: "$organizationId", count: { $sum: 1 } } },
    ]);
    const memberMap = new Map(
      memberCounts.map((m) => [m._id.toString(), m.count as number])
    );

    return {
      items: items.map((org) => ({
        id: org._id.toString(),
        name: org.name,
        slug: org.slug,
        subscriptionPlan: org.subscriptionPlan,
        isPersonalWorkspace: org.isPersonalWorkspace,
        status: org.status,
        memberCount: memberMap.get(org._id.toString()) ?? 0,
        createdAt: org.createdAt,
      })),
      meta: buildPaginationMeta(total, page, limit),
    };
  }
}
