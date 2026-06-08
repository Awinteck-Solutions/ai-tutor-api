import { body, param, query } from "express-validator";
import { FlashcardReviewResult } from "../../../shared/enums/progress.enum";

export const organizationIdQueryValidator = [
  query("organizationId").isMongoId().withMessage("Valid organization ID required"),
];

export const lessonProgressValidator = [
  param("lessonId").isMongoId(),
  body("progressPercent").optional().isInt({ min: 0, max: 100 }),
  body("timeSpentMinutes").optional().isInt({ min: 0 }),
  body("markComplete").optional().isBoolean(),
];

export const quizAttemptValidator = [
  body("quizId").isMongoId(),
  body("answers").isArray({ min: 1 }),
  body("answers.*.questionId").isMongoId(),
  body("answers.*.answer").trim().notEmpty(),
  body("timeSpentSeconds").optional().isInt({ min: 0 }),
];

export const flashcardReviewValidator = [
  body("flashcardId").isMongoId(),
  body("result")
    .isIn(Object.values(FlashcardReviewResult))
    .withMessage("result must be CORRECT or INCORRECT"),
];

export const dashboardValidator = [
  query("organizationId").isMongoId(),
  query("userId").optional().isMongoId(),
];
