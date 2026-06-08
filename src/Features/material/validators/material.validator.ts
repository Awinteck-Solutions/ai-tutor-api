import { body, param, query } from "express-validator";

const topicIdField = body("topicId").isMongoId().withMessage("Valid topic ID is required");

export const uploadPdfValidator = [
  body("organizationId").isMongoId().withMessage("Valid organization ID is required"),
  topicIdField,
  body("title").optional().trim(),
  body("description").optional().trim(),
  body("subjectName").optional().trim(),
  body("tags").optional().isArray(),
];

export const uploadTextValidator = [
  body("organizationId").isMongoId().withMessage("Valid organization ID is required"),
  topicIdField,
  body("title").trim().notEmpty().withMessage("Title is required"),
  body("content").trim().notEmpty().withMessage("Content is required"),
  body("description").optional().trim(),
  body("subjectName").optional().trim(),
  body("tags").optional().isArray(),
];

export const uploadYoutubeValidator = [
  body("organizationId").isMongoId().withMessage("Valid organization ID is required"),
  topicIdField,
  body("title").trim().notEmpty().withMessage("Title is required"),
  body("youtubeUrl")
    .trim()
    .notEmpty()
    .matches(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/)
    .withMessage("Valid YouTube URL is required"),
  body("description").optional().trim(),
  body("subjectName").optional().trim(),
  body("tags").optional().isArray(),
];

export const materialIdValidator = [
  param("id").isMongoId().withMessage("Invalid material ID"),
];

export const listMaterialsValidator = [
  query("organizationId").isMongoId().withMessage("Valid organization ID is required"),
  query("topicId").optional().isMongoId(),
  query("subjectId").optional().isMongoId(),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("processingStatus").optional().trim(),
  query("type").optional().trim(),
];
