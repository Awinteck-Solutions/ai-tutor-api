import { body, param, query } from "express-validator";
import mongoose from "mongoose";
import { ChatContextType } from "../../../shared/enums/chat.enum";

function sanitizeOptionalMongoId(value: unknown): string | undefined {
  if (typeof value !== "string" || !mongoose.Types.ObjectId.isValid(value)) {
    return undefined;
  }
  return value;
}

export const createSessionValidator = [
  body("organizationId").isMongoId(),
  body("contextType")
    .optional()
    .isIn(Object.values(ChatContextType))
    .withMessage("Invalid context type"),
  body("academicYearId").optional().customSanitizer(sanitizeOptionalMongoId),
  body("subjectId").optional().customSanitizer(sanitizeOptionalMongoId),
  body("topicId").optional().customSanitizer(sanitizeOptionalMongoId),
  body("materialId").optional().customSanitizer(sanitizeOptionalMongoId),
  body("lessonId").optional().customSanitizer(sanitizeOptionalMongoId),
  body("title").optional().trim(),
];

export const sendMessageValidator = [
  param("sessionId").isMongoId(),
  body("message").trim().notEmpty().withMessage("Message is required"),
];

export const sessionIdValidator = [
  param("sessionId").isMongoId(),
];

export const listSessionsValidator = [
  query("organizationId").isMongoId(),
];
