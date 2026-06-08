import { Router } from "express";
import { authenticate } from "../../../middlewares/authentication.middleware";
import { validate } from "../../../middlewares/validation.middleware";
import { asyncHandler } from "../../../shared/utils/asyncHandler";
import { FlashcardController } from "../../flashcard/controllers/flashcard.controller";
import { QuizController } from "../../quiz/controllers/quiz.controller";
import { LessonController } from "../controllers/lesson.controller";
import {
  generateLessonValidator,
  lessonIdParamValidator,
  lessonIdValidator,
  listLessonsValidator,
} from "../validators/lesson.validator";

const router = Router();

router.post(
  "/generate",
  authenticate,
  validate(generateLessonValidator),
  asyncHandler(LessonController.generate)
);

router.get(
  "/",
  authenticate,
  validate(listLessonsValidator),
  asyncHandler(LessonController.list)
);

router.get(
  "/:id/sources",
  authenticate,
  validate(lessonIdValidator),
  asyncHandler(LessonController.getSources)
);

router.get(
  "/:id",
  authenticate,
  validate(lessonIdValidator),
  asyncHandler(LessonController.getById)
);

router.post(
  "/:id/regenerate",
  authenticate,
  validate(lessonIdValidator),
  asyncHandler(LessonController.regenerate)
);

router.delete(
  "/:id",
  authenticate,
  validate(lessonIdValidator),
  asyncHandler(LessonController.delete)
);

router.post(
  "/:lessonId/flashcards/generate",
  authenticate,
  validate(lessonIdParamValidator),
  asyncHandler(LessonController.generateFlashcards)
);

router.get(
  "/:lessonId/flashcards",
  authenticate,
  validate(lessonIdParamValidator),
  asyncHandler(FlashcardController.listByLesson)
);

router.post(
  "/:lessonId/quiz/generate",
  authenticate,
  validate(lessonIdParamValidator),
  asyncHandler(LessonController.generateQuiz)
);

router.get(
  "/:lessonId/quiz",
  authenticate,
  validate(lessonIdParamValidator),
  asyncHandler(QuizController.getByLesson)
);

router.get(
  "/:lessonId/quiz/questions",
  authenticate,
  validate(lessonIdParamValidator),
  asyncHandler(QuizController.getQuestionsByLesson)
);

export default router;
