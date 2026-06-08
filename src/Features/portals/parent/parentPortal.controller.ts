import { Request, Response } from "express";
import { ApiResponse } from "../../../shared/utils/apiResponse";
import { ParentPortalService } from "./parentPortal.service";

export class ParentPortalController {
  static async dashboard(req: Request, res: Response): Promise<Response> {
    const data = await ParentPortalService.getDashboard(
      req.currentUser!,
      req.query.organizationId as string
    );
    return ApiResponse.success(res, data, "Parent dashboard retrieved");
  }

  static async studentProgress(req: Request, res: Response): Promise<Response> {
    const data = await ParentPortalService.getStudentProgress(
      req.currentUser!,
      req.query.organizationId as string,
      req.params.id
    );
    return ApiResponse.success(res, data, "Student progress retrieved");
  }

  static async studentAnalytics(req: Request, res: Response): Promise<Response> {
    const data = await ParentPortalService.getStudentAnalytics(
      req.currentUser!,
      req.query.organizationId as string,
      req.params.id
    );
    return ApiResponse.success(res, data, "Student analytics retrieved");
  }

  static async studentActivity(req: Request, res: Response): Promise<Response> {
    const data = await ParentPortalService.getStudentActivity(
      req.currentUser!,
      req.query.organizationId as string,
      req.params.id
    );
    return ApiResponse.success(res, data, "Student activity retrieved");
  }
}
