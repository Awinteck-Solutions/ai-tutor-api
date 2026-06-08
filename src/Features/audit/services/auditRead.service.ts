import { AccessControlService } from "../../../shared/services/accessControl.service";
import { JwtPayload } from "../../../types/express.d";
import User from "../../auth/models/user.model";
import {
  buildPaginationMeta,
  buildTextSearchFilter,
  parsePagination,
} from "../../../shared/utils/pagination";
import ActivityLog from "../models/activityLog.model";

export class AuditReadService {
  static async list(
    user: JwtPayload,
    query: {
      organizationId: string;
      activityType?: string;
      userId?: string;
      search?: string;
      page?: number;
      limit?: number;
    }
  ) {
    await AccessControlService.assertAdmin(user, query.organizationId);

    const { page, limit, skip } = parsePagination(query);
    const filter: Record<string, unknown> = {
      organizationId: query.organizationId,
    };

    if (query.activityType) filter.activityType = query.activityType;
    if (query.userId) filter.userId = query.userId;

    const searchFilter = buildTextSearchFilter(query.search, [
      "description",
      "activityType",
      "resourceType",
    ]);
    if (searchFilter) Object.assign(filter, searchFilter);

    const [items, total] = await Promise.all([
      ActivityLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      ActivityLog.countDocuments(filter),
    ]);

    const userIds = [
      ...new Set(
        items
          .map((log) => log.userId?.toString())
          .filter((id): id is string => Boolean(id))
      ),
    ];

    const users = userIds.length
      ? await User.find({ _id: { $in: userIds } }).select(
          "firstName lastName email"
        )
      : [];

    const userMap = new Map(
      users.map((u) => [
        u._id.toString(),
        {
          name: `${u.firstName} ${u.lastName}`.trim(),
          email: u.email,
        },
      ])
    );

    return {
      items: items.map((log) => {
        const actor = log.userId ? userMap.get(log.userId.toString()) : undefined;
        return {
          id: log._id.toString(),
          organizationId: log.organizationId?.toString(),
          userId: log.userId?.toString(),
          activityType: log.activityType,
          action: log.activityType,
          resourceType: log.resourceType,
          resourceId: log.resourceId,
          description: log.description,
          actorName: actor?.name ?? "System",
          actorEmail: actor?.email,
          metadata: log.metadata,
          ipAddress: log.ipAddress,
          createdAt: log.createdAt,
        };
      }),
      meta: buildPaginationMeta(total, page, limit),
    };
  }
}
