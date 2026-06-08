import { Request, Response } from "express";
import { ApiResponse } from "../../../shared/utils/apiResponse";
import { TeacherPortalService } from "./teacherPortal.service";

export class TeacherPortalController {
  static async dashboard(req: Request, res: Response): Promise<Response> {
    const data = await TeacherPortalService.getDashboard(
      req.currentUser!,
      req.query.organizationId as string
    );
    return ApiResponse.success(res, data, "Teacher dashboard retrieved");
  }

  static async subjects(req: Request, res: Response): Promise<Response> {
    const data = await TeacherPortalService.listSubjects(
      req.currentUser!,
      req.query.organizationId as string
    );
    return ApiResponse.success(res, data, "Subjects retrieved");
  }

  static async topics(req: Request, res: Response): Promise<Response> {
    const data = await TeacherPortalService.listTopics(
      req.currentUser!,
      req.query.organizationId as string,
      req.query.subjectId as string | undefined
    );
    return ApiResponse.success(res, data, "Topics retrieved");
  }

  static async lessons(req: Request, res: Response): Promise<Response> {
    const data = await TeacherPortalService.listLessons(
      req.currentUser!,
      req.query.organizationId as string,
      {
        subjectId: req.query.subjectId as string | undefined,
        topicId: req.query.topicId as string | undefined,
      }
    );
    return ApiResponse.success(res, data, "Lessons retrieved");
  }

  static async materials(req: Request, res: Response): Promise<Response> {
    const data = await TeacherPortalService.listMaterials(
      req.currentUser!,
      req.query.organizationId as string
    );
    return ApiResponse.success(res, data, "Materials retrieved");
  }

  static async students(req: Request, res: Response): Promise<Response> {
    const data = await TeacherPortalService.listStudents(
      req.currentUser!,
      req.query.organizationId as string
    );
    return ApiResponse.success(res, data, "Students retrieved");
  }

  static async studentById(req: Request, res: Response): Promise<Response> {
    const data = await TeacherPortalService.getStudent(
      req.currentUser!,
      req.query.organizationId as string,
      req.params.id
    );
    return ApiResponse.success(res, data, "Student retrieved");
  }
}
