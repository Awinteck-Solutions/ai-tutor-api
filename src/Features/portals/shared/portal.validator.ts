import { query, param, body } from "express-validator";

export const organizationIdQueryValidator = [
  query("organizationId").isMongoId().withMessage("Valid organizationId is required"),
];

/** For student self-study routes where org may be omitted and resolved server-side. */
export const optionalOrganizationIdQueryValidator = [
  query("organizationId")
    .optional()
    .isMongoId()
    .withMessage("Valid organizationId is required"),
];

export const optionalOrganizationIdBodyValidator = [
  body("organizationId")
    .optional()
    .isMongoId()
    .withMessage("Valid organizationId is required"),
];

export const studentIdParamValidator = [
  param("id").isMongoId().withMessage("Valid student id is required"),
  ...organizationIdQueryValidator,
];

export const lessonIdParamValidator = [
  param("id").isMongoId().withMessage("Valid lesson id is required"),
];

export const quizIdParamValidator = [
  param("id").isMongoId().withMessage("Valid quiz id is required"),
];

export const flashcardIdParamValidator = [
  param("id").isMongoId().withMessage("Valid flashcard id is required"),
];

export const sessionIdParamValidator = [
  param("id").isMongoId().withMessage("Valid session id is required"),
];

export const materialIdParamValidator = [
  param("id").isMongoId().withMessage("Valid material id is required"),
];
