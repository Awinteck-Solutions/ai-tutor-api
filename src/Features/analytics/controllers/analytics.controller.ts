import { Request, Response } from "express";
import { ApiResponse } from "../../../shared/utils/apiResponse";
import { AnalyticsService } from "../services/analytics.service";

export class AnalyticsController {
  static async student(req: Request, res: Response): Promise<Response> {
    const data = await AnalyticsService.studentDashboard(
      req.currentUser!,
      req.query.organizationId as string,
      req.query.studentId as string | undefined
    );
    return ApiResponse.success(res, data);
  }

  static async teacher(req: Request, res: Response): Promise<Response> {
    const data = await AnalyticsService.teacherAnalytics(
      req.currentUser!,
      req.query.organizationId as string
    );
    return ApiResponse.success(res, data);
  }

  static async organization(req: Request, res: Response): Promise<Response> {
    const data = await AnalyticsService.organizationAnalytics(
      req.currentUser!,
      req.params.organizationId
    );
    return ApiResponse.success(res, data);
  }

  static async flashcardRetention(req: Request, res: Response): Promise<Response> {
    const targetUserId = (req.query.userId as string) ?? req.currentUser!.sub;
    const data = await AnalyticsService.flashcardRetention(
      targetUserId,
      req.query.organizationId as string,
      req.currentUser!
    );
    return ApiResponse.success(res, data);
  }
}
