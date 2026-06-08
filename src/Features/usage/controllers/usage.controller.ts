import { Request, Response } from "express";
import { ApiResponse } from "../../../shared/utils/apiResponse";
import { UsageLimitService } from "../../../shared/services/usageLimit.service";
import { AccessControlService } from "../../../shared/services/accessControl.service";

export class UsageController {
  static async summary(req: Request, res: Response): Promise<Response> {
    const organizationId = req.params.organizationId;
    await AccessControlService.assertAdmin(req.currentUser!, organizationId);
    const data = await UsageLimitService.getUsageSummary(organizationId);
    return ApiResponse.success(res, data);
  }
}
