import { Request, Response } from "express";
import { ApiResponse } from "../../../shared/utils/apiResponse";
import { LessonService } from "../services/lesson.service";

export class LessonController {
  static async generate(req: Request, res: Response): Promise<Response> {
    const lesson = await LessonService.generate(req.currentUser!, req.body);
    return ApiResponse.created(res, lesson, "Lesson generation queued");
  }

  static async list(req: Request, res: Response): Promise<Response> {
    const result = await LessonService.list(req.currentUser!, {
      organizationId: req.query.organizationId as string,
      topicId: req.query.topicId as string | undefined,
      subjectId: req.query.subjectId as string | undefined,
      page: Number(req.query.page),
      limit: Number(req.query.limit),
      search: req.query.search as string | undefined,
    });
    return ApiResponse.success(res, result, "Lessons retrieved");
  }

  static async getSources(req: Request, res: Response): Promise<Response> {
    const sources = await LessonService.getSources(
      req.currentUser!,
      req.params.id
    );
    return ApiResponse.success(res, sources, "Lesson sources retrieved");
  }

  static async getById(req: Request, res: Response): Promise<Response> {
    const lesson = await LessonService.getById(req.currentUser!, req.params.id);
    return ApiResponse.success(res, lesson, "Lesson retrieved");
  }

  static async regenerate(req: Request, res: Response): Promise<Response> {
    const lesson = await LessonService.regenerate(
      req.currentUser!,
      req.params.id,
      { studentLevel: req.body.studentLevel }
    );
    return ApiResponse.success(res, lesson, "Lesson regeneration queued");
  }

  static async delete(req: Request, res: Response): Promise<Response> {
    await LessonService.delete(req.currentUser!, req.params.id);
    return ApiResponse.success(res, null, "Lesson deleted");
  }

  static async generateFlashcards(
    req: Request,
    res: Response
  ): Promise<Response> {
    const result = await LessonService.generateFlashcards(
      req.currentUser!,
      req.params.lessonId
    );
    return ApiResponse.success(res, result, result.message);
  }

  static async generateQuiz(req: Request, res: Response): Promise<Response> {
    const result = await LessonService.generateQuiz(
      req.currentUser!,
      req.params.lessonId
    );
    return ApiResponse.success(res, result, result.message);
  }
}
