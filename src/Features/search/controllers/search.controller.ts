import { Request, Response } from "express";
import { ApiResponse } from "../../../shared/utils/apiResponse";
import { SearchService } from "../services/search.service";

export class SearchController {
  static async search(req: Request, res: Response): Promise<Response> {
    const data = await SearchService.search({
      organizationId: req.query.organizationId as string,
      q: req.query.q as string,
      types: req.query.types ? (req.query.types as string).split(",") : undefined,
      page: Number(req.query.page),
      limit: Number(req.query.limit),
      user: req.currentUser!,
    });
    return ApiResponse.success(res, data);
  }
}
