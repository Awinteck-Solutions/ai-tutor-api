import { NotificationType } from "../../../shared/enums/notificationType.enum";
import { Status } from "../../../shared/enums/status.enum";
import {
  buildPaginationMeta,
  buildTextSearchFilter,
  parsePagination,
} from "../../../shared/utils/pagination";
import Notification from "../models/notification.model";

interface CreateNotificationInput {
  userId: string;
  organizationId?: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export class NotificationService {
  static async create(input: CreateNotificationInput) {
    return Notification.create(input);
  }

  static async list(
    userId: string,
    query: {
      page?: number;
      limit?: number;
      unreadOnly?: boolean;
      search?: string;
    }
  ) {
    const { page, limit, skip } = parsePagination(query);
    const filter: Record<string, unknown> = {
      userId,
      status: Status.ACTIVE,
    };
    if (query.unreadOnly) filter.readAt = { $exists: false };

    const searchFilter = buildTextSearchFilter(query.search, ["title", "body"]);
    if (searchFilter) Object.assign(filter, searchFilter);

    const [items, total] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments(filter),
    ]);

    return {
      items: items.map((n) => ({
        id: n._id.toString(),
        type: n.type,
        title: n.title,
        body: n.body,
        message: n.body,
        read: Boolean(n.readAt),
        readAt: n.readAt,
        organizationId: n.organizationId?.toString(),
        createdAt: n.createdAt,
      })),
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  static async markRead(userId: string, notificationId: string) {
    return Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { readAt: new Date() },
      { new: true }
    );
  }

  static async markAllRead(userId: string) {
    await Notification.updateMany(
      { userId, readAt: { $exists: false } },
      { readAt: new Date() }
    );
  }
}
