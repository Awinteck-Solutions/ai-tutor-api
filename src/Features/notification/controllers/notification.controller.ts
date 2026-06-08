import { Request, Response } from "express";
import { ApiResponse } from "../../../shared/utils/apiResponse";
import { NotificationService } from "../services/notification.service";

export class NotificationController {
  static async list(req: Request, res: Response): Promise<Response> {
    const data = await NotificationService.list(req.currentUser!.sub, {
      page: Number(req.query.page),
      limit: Number(req.query.limit),
      unreadOnly: req.query.unreadOnly === "true",
      search: req.query.search as string | undefined,
    });
    return ApiResponse.success(res, data);
  }

  static async markRead(req: Request, res: Response): Promise<Response> {
    const data = await NotificationService.markRead(req.currentUser!.sub, req.params.id);
    return ApiResponse.success(res, data, "Notification marked as read");
  }

  static async markAllRead(req: Request, res: Response): Promise<Response> {
    await NotificationService.markAllRead(req.currentUser!.sub);
    return ApiResponse.success(res, null, "All notifications marked as read");
  }
}
