import { Request, Response } from "express";
import { ApiResponse } from "../../../shared/utils/apiResponse";
import { AccessControlService } from "../../../shared/services/accessControl.service";
import { ProgressService } from "../services/progress.service";
import { SpacedRepetitionService } from "../services/spacedRepetition.service";

export class ProgressController {
  static async getDashboard(req: Request, res: Response): Promise<Response> {
    const dashboard = await ProgressService.getDashboard(
      req.currentUser!,
      req.query.organizationId as string,
      req.query.userId as string | undefined
    );
    return ApiResponse.success(res, dashboard, "Progress dashboard retrieved");
  }

  static async listLessonProgress(
    req: Request,
    res: Response
  ): Promise<Response> {
    const progress = await ProgressService.listLessonProgress(
      req.currentUser!,
      req.query.organizationId as string
    );
    return ApiResponse.success(res, progress, "Lesson progress retrieved");
  }

  static async updateLessonProgress(
    req: Request,
    res: Response
  ): Promise<Response> {
    const progress = await ProgressService.updateLessonProgress(
      req.currentUser!,
      req.params.lessonId,
      req.body
    );
    return ApiResponse.success(res, progress, "Lesson progress updated");
  }

  static async submitQuizAttempt(
    req: Request,
    res: Response
  ): Promise<Response> {
    const attempt = await ProgressService.submitQuizAttempt(
      req.currentUser!,
      req.body
    );
    return ApiResponse.created(res, attempt, "Quiz attempt submitted");
  }

  static async recordFlashcardReview(
    req: Request,
    res: Response
  ): Promise<Response> {
    const result = await ProgressService.recordFlashcardReview(
      req.currentUser!,
      req.body
    );
    return ApiResponse.success(res, result, "Flashcard review recorded");
  }

  static async getDueFlashcards(req: Request, res: Response): Promise<Response> {
    const organizationId = req.query.organizationId as string;
    await AccessControlService.assertOrgRead(req.currentUser!, organizationId);
    const cards = await SpacedRepetitionService.getDueCards(
      req.currentUser!.sub,
      organizationId,
      Number(req.query.limit) || 20
    );
    return ApiResponse.success(res, cards, "Due flashcards retrieved");
  }
}
