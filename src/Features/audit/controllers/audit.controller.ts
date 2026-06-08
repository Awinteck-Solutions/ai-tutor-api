import { Request, Response } from "express";
import { ApiResponse } from "../../../shared/utils/apiResponse";
import { AuditReadService } from "../services/auditRead.service";

export class AuditController {
  static async list(req: Request, res: Response): Promise<Response> {
    const data = await AuditReadService.list(req.currentUser!, {
      organizationId: req.query.organizationId as string,
      activityType: req.query.activityType as string | undefined,
      userId: req.query.userId as string | undefined,
      search: req.query.search as string | undefined,
      page: Number(req.query.page),
      limit: Number(req.query.limit),
    });
    return ApiResponse.success(res, data, "Audit logs retrieved");
  }
}
