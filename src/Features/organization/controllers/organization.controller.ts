import { Request, Response } from "express";
import { ApiResponse } from "../../../shared/utils/apiResponse";
import { OrganizationService } from "../services/organization.service";

export class OrganizationController {
  static async create(req: Request, res: Response): Promise<Response> {
    const org = await OrganizationService.create(req.currentUser!.sub, req.body);
    return ApiResponse.created(res, org, "Organization created");
  }

  static async getById(req: Request, res: Response): Promise<Response> {
    const org = await OrganizationService.getById(req.currentUser!, req.params.id);
    return ApiResponse.success(res, org, "Organization retrieved");
  }

  static async list(req: Request, res: Response): Promise<Response> {
    const result = await OrganizationService.list({
      page: Number(req.query.page),
      limit: Number(req.query.limit),
      search: req.query.search as string | undefined,
    });
    return ApiResponse.success(res, result, "Organizations retrieved");
  }

  static async update(req: Request, res: Response): Promise<Response> {
    const org = await OrganizationService.update(req.params.id, req.body);
    return ApiResponse.success(res, org, "Organization updated");
  }

  static async addMember(req: Request, res: Response): Promise<Response> {
    const org = await OrganizationService.addMember(req.params.id, req.body);
    return ApiResponse.success(res, org, "Member added");
  }

  static async removeMember(req: Request, res: Response): Promise<Response> {
    const org = await OrganizationService.removeMember(
      req.params.id,
      req.params.userId
    );
    return ApiResponse.success(res, org, "Member removed");
  }

  static async delete(req: Request, res: Response): Promise<Response> {
    await OrganizationService.delete(req.params.id);
    return ApiResponse.success(res, null, "Organization deleted");
  }
}
