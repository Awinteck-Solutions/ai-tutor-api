import { body, param, query } from "express-validator";

export const generateLessonValidator = [
  body("topicId").isMongoId().withMessage("Valid topic ID is required"),
  body("materialIds")
    .isArray({ min: 1, max: 10 })
    .withMessage("Select 1–10 materials for the lesson"),
  body("materialIds.*").isMongoId().withMessage("Each material ID must be valid"),
  body("title").optional().trim().optional(),//.notEmpty(),
  body("order").optional().isInt({ min: 0 }),
];

export const lessonIdValidator = [
  param("id").isMongoId().withMessage("Invalid lesson ID"),
];

export const listLessonsValidator = [
  query("organizationId").isMongoId().withMessage("Valid organization ID is required"),
  query("topicId").optional().isMongoId(),
  query("subjectId").optional().isMongoId(),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
];

export const lessonIdParamValidator = [
  param("lessonId").isMongoId().withMessage("Invalid lesson ID"),
];

export const quizIdValidator = [
  param("id").isMongoId().withMessage("Invalid quiz ID"),
];
