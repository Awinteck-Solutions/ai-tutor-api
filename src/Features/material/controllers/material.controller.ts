import { Request, Response } from "express";
import { ApiResponse } from "../../../shared/utils/apiResponse";
import { MaterialService } from "../services/material.service";

export class MaterialController {
  static async uploadPdf(req: Request, res: Response): Promise<Response> {
    if (!req.file) {
      return ApiResponse.error(res, "PDF file is required", 400);
    }

    const result = await MaterialService.uploadPdf(
      req.currentUser!,
      req.body,
      req.file
    );
    return ApiResponse.created(res, result, "PDF uploaded — processing queued");
  }

  static async uploadText(req: Request, res: Response): Promise<Response> {
    const result = await MaterialService.uploadText(req.currentUser!, req.body);
    return ApiResponse.created(res, result, "Text uploaded — processing queued");
  }

  static async uploadYoutube(req: Request, res: Response): Promise<Response> {
    const result = await MaterialService.uploadYoutube(
      req.currentUser!,
      req.body
    );
    return ApiResponse.created(
      res,
      result,
      "YouTube link added — processing queued"
    );
  }

  static async list(req: Request, res: Response): Promise<Response> {
    const result = await MaterialService.list(req.currentUser!, {
      organizationId: req.query.organizationId as string,
      topicId: req.query.topicId as string | undefined,
      subjectId: req.query.subjectId as string | undefined,
      page: Number(req.query.page),
      limit: Number(req.query.limit),
      processingStatus: req.query.processingStatus as string | undefined,
      type: req.query.type as string | undefined,
      search: req.query.search as string | undefined,
    });
    return ApiResponse.success(res, result, "Materials retrieved");
  }

  static async getById(req: Request, res: Response): Promise<Response> {
    const result = await MaterialService.getById(
      req.currentUser!,
      req.params.id
    );
    return ApiResponse.success(res, result, "Material retrieved");
  }

  static async getChunks(req: Request, res: Response): Promise<Response> {
    const result = await MaterialService.getChunks(
      req.currentUser!,
      req.params.id
    );
    return ApiResponse.success(res, result, "Material chunks retrieved");
  }

  static async archive(req: Request, res: Response): Promise<Response> {
    const result = await MaterialService.archive(req.currentUser!, req.params.id);
    return ApiResponse.success(res, result, "Material archived");
  }

  static async getProcessingLogs(req: Request, res: Response): Promise<Response> {
    const result = await MaterialService.getProcessingLogs(req.currentUser!, req.params.id);
    return ApiResponse.success(res, result, "Processing logs retrieved");
  }

  static async reprocess(req: Request, res: Response): Promise<Response> {
    const result = await MaterialService.reprocess(
      req.currentUser!,
      req.params.id
    );
    return ApiResponse.success(res, result, "Material reprocessing queued");
  }

  static async delete(req: Request, res: Response): Promise<Response> {
    await MaterialService.delete(req.currentUser!, req.params.id);
    return ApiResponse.success(res, null, "Material deleted");
  }
}
