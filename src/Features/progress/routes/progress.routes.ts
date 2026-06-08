import { Router } from "express";
import { authenticate } from "../../../middlewares/authentication.middleware";
import { validate } from "../../../middlewares/validation.middleware";
import { asyncHandler } from "../../../shared/utils/asyncHandler";
import { ProgressController } from "../controllers/progress.controller";
import {
  dashboardValidator,
  flashcardReviewValidator,
  lessonProgressValidator,
  organizationIdQueryValidator,
  quizAttemptValidator,
} from "../validators/progress.validator";

const router = Router();

router.get(
  "/dashboard",
  authenticate,
  validate(dashboardValidator),
  asyncHandler(ProgressController.getDashboard)
);

router.get(
  "/lessons",
  authenticate,
  validate(organizationIdQueryValidator),
  asyncHandler(ProgressController.listLessonProgress)
);

router.patch(
  "/lessons/:lessonId",
  authenticate,
  validate(lessonProgressValidator),
  asyncHandler(ProgressController.updateLessonProgress)
);

router.post(
  "/quiz-attempts",
  authenticate,
  validate(quizAttemptValidator),
  asyncHandler(ProgressController.submitQuizAttempt)
);

router.post(
  "/flashcard-reviews",
  authenticate,
  validate(flashcardReviewValidator),
  asyncHandler(ProgressController.recordFlashcardReview)
);

router.get(
  "/flashcards/due",
  authenticate,
  validate(organizationIdQueryValidator),
  asyncHandler(ProgressController.getDueFlashcards)
);

export default router;
