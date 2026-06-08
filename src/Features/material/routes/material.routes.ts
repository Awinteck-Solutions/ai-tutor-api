import { Router } from "express";
import { authenticate } from "../../../middlewares/authentication.middleware";
import { validate } from "../../../middlewares/validation.middleware";
import { asyncHandler } from "../../../shared/utils/asyncHandler";
import { pdfUpload } from "../../../helpers/uploader";
import { MaterialController } from "../controllers/material.controller";
import {
  listMaterialsValidator,
  materialIdValidator,
  uploadPdfValidator,
  uploadTextValidator,
  uploadYoutubeValidator,
} from "../validators/material.validator";

const router = Router();

/**
 * @swagger
 * /materials/upload/pdf:
 *   post:
 *     summary: Upload a PDF material
 *     description: Uploads PDF to Cloudflare R2 and queues async AI processing (extract, chunk, embed, index in Qdrant).
 *     tags: [Materials]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, organizationId, title]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: PDF file (max 50MB)
 *               organizationId:
 *                 type: string
 *                 description: MongoDB ObjectId of the organization
 *               title:
 *                 type: string
 *                 example: "Biology Chapter 3"
 *               description:
 *                 type: string
 *               subjectName:
 *                 type: string
 *                 example: "Biology"
 *               tags:
 *                 type: array
 *                 items: { type: string }
 *     responses:
 *       201:
 *         description: PDF uploaded — processing queued
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Material'
 *       503:
 *         description: R2 storage or Redis queue unavailable
 */
router.post(
  "/upload/pdf",
  authenticate,
  pdfUpload.single("file"),
  validate(uploadPdfValidator),
  asyncHandler(MaterialController.uploadPdf)
);

/**
 * @swagger
 * /materials/upload/text:
 *   post:
 *     summary: Upload text content as material
 *     description: Stores text directly and queues async AI processing.
 *     tags: [Materials]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [organizationId, title, content]
 *             properties:
 *               organizationId: { type: string }
 *               title: { type: string, example: "Photosynthesis Notes" }
 *               content: { type: string, example: "Photosynthesis is the process..." }
 *               description: { type: string }
 *               subjectName: { type: string }
 *               tags: { type: array, items: { type: string } }
 *     responses:
 *       201:
 *         description: Text uploaded — processing queued
 */
router.post(
  "/upload/text",
  authenticate,
  validate(uploadTextValidator),
  asyncHandler(MaterialController.uploadText)
);

/**
 * @swagger
 * /materials/youtube:
 *   post:
 *     summary: Add a YouTube video as material
 *     description: Fetches video transcript in background and queues AI processing.
 *     tags: [Materials]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [organizationId, title, youtubeUrl]
 *             properties:
 *               organizationId: { type: string }
 *               title: { type: string, example: "Khan Academy - Algebra" }
 *               youtubeUrl:
 *                 type: string
 *                 example: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
 *               description: { type: string }
 *               subjectName: { type: string }
 *               tags: { type: array, items: { type: string } }
 *     responses:
 *       201:
 *         description: YouTube link added — processing queued
 */
router.post(
  "/youtube",
  authenticate,
  validate(uploadYoutubeValidator),
  asyncHandler(MaterialController.uploadYoutube)
);

/**
 * @swagger
 * /materials:
 *   get:
 *     summary: List materials for an organization
 *     tags: [Materials]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: organizationId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: processingStatus
 *         schema:
 *           type: string
 *           enum: [PENDING, QUEUED, PROCESSING, COMPLETED, FAILED]
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [PDF, TEXT, YOUTUBE]
 *     responses:
 *       200:
 *         description: Materials retrieved
 */
router.get(
  "/",
  authenticate,
  validate(listMaterialsValidator),
  asyncHandler(MaterialController.list)
);

/**
 * @swagger
 * /materials/{id}:
 *   get:
 *     summary: Get material by ID
 *     description: Returns material metadata including processingStatus, summary, and chunkCount.
 *     tags: [Materials]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Material retrieved
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Material'
 */
router.get(
  "/:id",
  authenticate,
  validate(materialIdValidator),
  asyncHandler(MaterialController.getById)
);

/**
 * @swagger
 * /materials/{id}/chunks:
 *   get:
 *     summary: Get processed text chunks for a material
 *     description: Available after processingStatus is COMPLETED.
 *     tags: [Materials]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Chunks retrieved
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/MaterialChunk'
 *       422:
 *         description: Processing not complete
 */
router.get(
  "/:id/chunks",
  authenticate,
  validate(materialIdValidator),
  asyncHandler(MaterialController.getChunks)
);

/**
 * @swagger
 * /materials/{id}/reprocess:
 *   post:
 *     summary: Re-queue material for AI processing
 *     tags: [Materials]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Reprocessing queued
 */
router.post(
  "/:id/reprocess",
  authenticate,
  validate(materialIdValidator),
  asyncHandler(MaterialController.reprocess)
);

router.patch(
  "/:id/archive",
  authenticate,
  validate(materialIdValidator),
  asyncHandler(MaterialController.archive)
);

router.get(
  "/:id/processing-logs",
  authenticate,
  validate(materialIdValidator),
  asyncHandler(MaterialController.getProcessingLogs)
);

/**
 * @swagger
 * /materials/{id}:
 *   delete:
 *     summary: Delete material and associated vectors
 *     description: Soft-deletes material, removes R2 file and Qdrant vectors.
 *     tags: [Materials]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Material deleted
 */
router.delete(
  "/:id",
  authenticate,
  validate(materialIdValidator),
  asyncHandler(MaterialController.delete)
);

export default router;
