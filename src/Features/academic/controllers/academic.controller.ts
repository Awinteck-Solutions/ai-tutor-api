import { Request, Response } from "express";
import { ApiResponse } from "../../../shared/utils/apiResponse";
import { AcademicService } from "../services/academic.service";

export class AcademicController {
  static async createYear(req: Request, res: Response): Promise<Response> {
    const data = await AcademicService.createYear(req.currentUser!, req.params.organizationId, req.body);
    return ApiResponse.created(res, data, "Academic year created");
  }

  static async listYears(req: Request, res: Response): Promise<Response> {
    const data = await AcademicService.listYears(req.currentUser!, req.params.organizationId, {
      page: Number(req.query.page),
      limit: Number(req.query.limit),
      search: req.query.search as string | undefined,
    });
    return ApiResponse.success(res, data);
  }

  static async createTerm(req: Request, res: Response): Promise<Response> {
    const data = await AcademicService.createTerm(req.currentUser!, req.params.organizationId, req.body);
    return ApiResponse.created(res, data, "Term created");
  }

  static async listTerms(req: Request, res: Response): Promise<Response> {
    const data = await AcademicService.listTerms(
      req.currentUser!,
      req.params.organizationId,
      req.params.yearId,
      {
        page: Number(req.query.page),
        limit: Number(req.query.limit),
        search: req.query.search as string | undefined,
      }
    );
    return ApiResponse.success(res, data);
  }

  static async createSubject(req: Request, res: Response): Promise<Response> {
    const data = await AcademicService.createSubject(req.currentUser!, req.params.organizationId, req.body);
    return ApiResponse.created(res, data, "Subject created");
  }

  static async listSubjectEnrollments(req: Request, res: Response): Promise<Response> {
    const data = await AcademicService.listSubjectEnrollments(
      req.currentUser!,
      req.params.organizationId,
      req.params.subjectId
    );
    return ApiResponse.success(res, data, "Subject enrollments retrieved");
  }

  static async listSubjects(req: Request, res: Response): Promise<Response> {
    const data = await AcademicService.listSubjects(req.currentUser!, req.params.organizationId, {
      academicYearId: req.query.academicYearId as string | undefined,
      page: Number(req.query.page),
      limit: Number(req.query.limit),
      search: req.query.search as string | undefined,
    });
    return ApiResponse.success(res, data);
  }

  static async createTopic(req: Request, res: Response): Promise<Response> {
    const data = await AcademicService.createTopic(req.currentUser!, req.params.organizationId, req.body);
    return ApiResponse.created(res, data, "Topic created");
  }

  static async listTopics(req: Request, res: Response): Promise<Response> {
    const data = await AcademicService.listTopics(
      req.currentUser!,
      req.params.organizationId,
      req.params.subjectId,
      {
        page: Number(req.query.page),
        limit: Number(req.query.limit),
        search: req.query.search as string | undefined,
      }
    );
    return ApiResponse.success(res, data);
  }

  static async reorderTopics(req: Request, res: Response): Promise<Response> {
    const data = await AcademicService.reorderTopics(
      req.currentUser!,
      req.params.organizationId,
      req.params.subjectId,
      req.body.orderedIds
    );
    return ApiResponse.success(res, data, "Topics reordered");
  }
}
