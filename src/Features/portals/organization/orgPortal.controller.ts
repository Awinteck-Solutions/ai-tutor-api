import { Request, Response } from "express";
import { ApiResponse } from "../../../shared/utils/apiResponse";
import { OrgPortalService } from "./orgPortal.service";

export class OrgPortalController {
  static async dashboard(req: Request, res: Response): Promise<Response> {
    const data = await OrgPortalService.getDashboard(
      req.currentUser!,
      req.query.organizationId as string
    );
    return ApiResponse.success(res, data, "Organization dashboard retrieved");
  }

  static async usage(req: Request, res: Response): Promise<Response> {
    const data = await OrgPortalService.getUsage(
      req.currentUser!,
      req.query.organizationId as string
    );
    return ApiResponse.success(res, data, "Usage analytics retrieved");
  }

  static async subscription(req: Request, res: Response): Promise<Response> {
    const data = await OrgPortalService.getSubscription(
      req.currentUser!,
      req.query.organizationId as string
    );
    return ApiResponse.success(res, data, "Subscription retrieved");
  }
}
