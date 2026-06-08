import { Request, Response } from "express";
import { ApiResponse } from "../../../shared/utils/apiResponse";
import { FlashcardService } from "../services/flashcard.service";

export class FlashcardController {
  static async listByLesson(req: Request, res: Response): Promise<Response> {
    const cards = await FlashcardService.listByLesson(
      req.currentUser!,
      req.params.lessonId
    );
    return ApiResponse.success(res, cards, "Flashcards retrieved");
  }
}
