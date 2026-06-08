import { Request, Response } from "express";
import { ApiResponse } from "../../../shared/utils/apiResponse";
import { QuizService } from "../services/quiz.service";

export class QuizController {
  static async getByLesson(req: Request, res: Response): Promise<Response> {
    const quiz = await QuizService.getByLesson(
      req.currentUser!,
      req.params.lessonId
    );
    return ApiResponse.success(res, quiz, "Quiz retrieved");
  }

  static async getById(req: Request, res: Response): Promise<Response> {
    const includeAnswers = req.query.includeAnswers === "true";
    const quiz = await QuizService.getById(
      req.currentUser!,
      req.params.id,
      includeAnswers
    );
    return ApiResponse.success(res, quiz, "Quiz retrieved");
  }

  static async getQuestionsByLesson(
    req: Request,
    res: Response
  ): Promise<Response> {
    const questions = await QuizService.getQuestionsByLesson(
      req.currentUser!,
      req.params.lessonId
    );
    return ApiResponse.success(res, questions, "Quiz questions retrieved");
  }
}
