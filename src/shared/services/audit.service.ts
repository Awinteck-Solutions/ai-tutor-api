import { Request } from "express";
import { ActivityType } from "../../shared/enums/activityType.enum";
import ActivityLog from "../../Features/audit/models/activityLog.model";
import { Logger } from "./logger";

interface AuditInput {
  activityType: ActivityType;
  description: string;
  organizationId?: string;
  userId?: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  req?: Request;
}

export class AuditService {
  static async log(input: AuditInput): Promise<void> {
    try {
      await ActivityLog.create({
        organizationId: input.organizationId,
        userId: input.userId,
        activityType: input.activityType,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        description: input.description,
        metadata: input.metadata,
        ipAddress: input.req?.ip,
      });
    } catch (error) {
      Logger.warn("Failed to write audit log", {
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }
}
