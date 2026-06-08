import { SubscriptionPlan } from "../enums/subscriptionPlan.enum";
import { AppError } from "../errors/AppError";
import mongoose from "mongoose";
import AIUsageLog from "../../Features/usage/models/aiUsageLog.model";
import Organization from "../../Features/organization/models/organization.model";
import Material from "../../Features/material/models/material.model";
import { Status } from "../enums/status.enum";

const MONTHLY_LIMITS: Record<SubscriptionPlan, { requests: number; tokens: number }> = {
  [SubscriptionPlan.FREE]: { requests: 500, tokens: 200_000 },
  [SubscriptionPlan.BASIC]: { requests: 5_000, tokens: 2_000_000 },
  [SubscriptionPlan.PRO]: { requests: 25_000, tokens: 10_000_000 },
  [SubscriptionPlan.ENTERPRISE]: { requests: 1_000_000, tokens: 500_000_000 },
};

export class UsageLimitService {
  static async assertWithinLimits(organizationId: string): Promise<void> {
    const org = await Organization.findById(organizationId);
    if (!org) throw new AppError("Organization not found", 404);

    const limits = MONTHLY_LIMITS[org.subscriptionPlan] ?? MONTHLY_LIMITS[SubscriptionPlan.FREE];
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const usage = await AIUsageLog.aggregate([
      {
        $match: {
          organizationId: org._id,
          createdAt: { $gte: startOfMonth },
        },
      },
      {
        $group: {
          _id: null,
          requests: { $sum: "$requestCount" },
          tokens: { $sum: "$tokensUsed" },
        },
      },
    ]);

    const current = usage[0] ?? { requests: 0, tokens: 0 };
    if (current.requests >= limits.requests) {
      throw new AppError("Monthly AI request limit reached for your plan", 429);
    }
    if (current.tokens >= limits.tokens) {
      throw new AppError("Monthly AI token limit reached for your plan", 429);
    }
  }

  static async recordUsage(input: {
    organizationId: string;
    userId?: string;
    operation: string;
    tokensUsed?: number;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await AIUsageLog.create({
      organizationId: input.organizationId,
      userId: input.userId,
      operation: input.operation,
      tokensUsed: input.tokensUsed ?? 0,
      requestCount: 1,
      metadata: input.metadata,
    });
  }

  static async getUsageSummary(organizationId: string) {
    const org = await Organization.findById(organizationId);
    if (!org) throw new AppError("Organization not found", 404);

    const limits = MONTHLY_LIMITS[org.subscriptionPlan] ?? MONTHLY_LIMITS[SubscriptionPlan.FREE];
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const usage = await AIUsageLog.aggregate([
      { $match: { organizationId: org._id, createdAt: { $gte: startOfMonth } } },
      {
        $group: {
          _id: "$operation",
          requests: { $sum: "$requestCount" },
          tokens: { $sum: "$tokensUsed" },
        },
      },
    ]);

    const totals = usage.reduce(
      (acc, row) => ({
        requests: acc.requests + row.requests,
        tokens: acc.tokens + row.tokens,
      }),
      { requests: 0, tokens: 0 }
    );

    return { plan: org.subscriptionPlan, limits, usage: totals, breakdown: usage };
  }

  static async getStorageUsage(organizationId: string) {
    const orgOid = new mongoose.Types.ObjectId(organizationId);
    const agg = await Material.aggregate([
      {
        $match: {
          organizationId: orgOid,
          status: { $ne: Status.DELETED },
        },
      },
      {
        $group: {
          _id: null,
          totalBytes: { $sum: { $ifNull: ["$fileSize", 0] } },
          materialCount: { $sum: 1 },
        },
      },
    ]);

    const row = agg[0];
    return {
      totalBytes: row?.totalBytes ?? 0,
      totalMegabytes: Math.round(((row?.totalBytes ?? 0) / (1024 * 1024)) * 100) / 100,
      materialCount: row?.materialCount ?? 0,
    };
  }
}
