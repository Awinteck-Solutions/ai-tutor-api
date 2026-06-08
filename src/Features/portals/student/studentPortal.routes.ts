import { Router } from "express";
import { body, query } from "express-validator";
import { authenticate } from "../../../middlewares/authentication.middleware";
import { authorize } from "../../../middlewares/authorization.middleware";
import { validate } from "../../../middlewares/validation.middleware";
import { asyncHandler } from "../../../shared/utils/asyncHandler";
import { pdfUpload } from "../../../helpers/uploader";
import { Role } from "../../../shared/enums/roles.enum";
import { FlashcardReviewResult } from "../../../shared/enums/progress.enum";
import {
  organizationIdQueryValidator,
  lessonIdParamValidator,
  materialIdParamValidator,
  quizIdParamValidator,
  flashcardIdParamValidator,
  sessionIdParamValidator,
} from "../shared/portal.validator";
import { StudentPortalController } from "./studentPortal.controller";

const router = Router();

const studentAuth = [
  authenticate,
  authorize(Role.STUDENT, Role.SUPER_ADMIN),
];

router.get(
  "/dashboard",
  ...studentAuth,
  validate(organizationIdQueryValidator),
  asyncHandler(StudentPortalController.dashboard)
);

router.get(
  "/continue-learning",
  ...studentAuth,
  validate(organizationIdQueryValidator),
  asyncHandler(StudentPortalController.continueLearning)
);

router.get(
  "/lessons",
  ...studentAuth,
  validate(organizationIdQueryValidator),
  asyncHandler(StudentPortalController.lessons)
);

router.get(
  "/lessons/:id",
  ...studentAuth,
  validate([...organizationIdQueryValidator, ...lessonIdParamValidator]),
  asyncHandler(StudentPortalController.lessonDetail)
);

router.post(
  "/lessons/:id/complete",
  ...studentAuth,
  validate(lessonIdParamValidator),
  asyncHandler(StudentPortalController.completeLesson)
);

router.get(
  "/flashcards/review",
  ...studentAuth,
  validate(organizationIdQueryValidator),
  asyncHandler(StudentPortalController.reviewFlashcards)
);

router.post(
  "/flashcards/:id/review",
  ...studentAuth,
  validate([
    ...flashcardIdParamValidator,
    body("result")
      .isIn(Object.values(FlashcardReviewResult))
      .withMessage("result must be CORRECT or INCORRECT"),
  ]),
  asyncHandler(StudentPortalController.submitFlashcardReview)
);

router.post(
  "/quizzes/:id/start",
  ...studentAuth,
  validate(quizIdParamValidator),
  asyncHandler(StudentPortalController.startQuiz)
);

router.post(
  "/quizzes/:id/submit",
  ...studentAuth,
  validate([
    ...quizIdParamValidator,
    body("answers").isArray({ min: 1 }),
    body("answers.*.questionId").isMongoId(),
    body("answers.*.answer").isString(),
    body("practice").optional().isBoolean(),
  ]),
  asyncHandler(StudentPortalController.submitQuiz)
);

router.get(
  "/quizzes/:id/draft",
  ...studentAuth,
  validate(quizIdParamValidator),
  asyncHandler(StudentPortalController.getQuizDraft)
);

router.put(
  "/quizzes/:id/draft",
  ...studentAuth,
  validate([
    ...quizIdParamValidator,
    body("answers").isArray(),
    body("answers.*.questionId").isMongoId(),
    body("answers.*.answer").isString(),
    body("currentStep").optional().isInt({ min: 0 }),
  ]),
  asyncHandler(StudentPortalController.saveQuizDraft)
);

router.post(
  "/self-study/lessons",
  ...studentAuth,
  validate([
    body("organizationId").isMongoId(),
    body("prompt").trim().isLength({ min: 10, max: 8000 }),
    body("title").optional().trim().isLength({ max: 200 }),
  ]),
  asyncHandler(StudentPortalController.createPersonalLesson)
);

router.post(
  "/self-study/lessons/from-materials",
  ...studentAuth,
  validate([
    body("organizationId").isMongoId(),
    body("materialIds").isArray({ min: 1 }),
    body("materialIds.*").isMongoId(),
    body("title").optional().trim().isLength({ max: 200 }),
  ]),
  asyncHandler(StudentPortalController.createPersonalLessonFromMaterials)
);

router.get(
  "/self-study/materials",
  ...studentAuth,
  validate([
    ...organizationIdQueryValidator,
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 50 }),
    query("search").optional().trim().isLength({ max: 200 }),
    query("processingStatus").optional().trim(),
  ]),
  asyncHandler(StudentPortalController.listSelfStudyMaterials)
);

router.delete(
  "/self-study/materials/:id",
  ...studentAuth,
  validate([...organizationIdQueryValidator, ...materialIdParamValidator]),
  asyncHandler(StudentPortalController.deleteSelfStudyMaterial)
);

router.post(
  "/self-study/materials/upload/pdf",
  ...studentAuth,
  pdfUpload.single("file"),
  validate([
    body("organizationId").isMongoId(),
    body("title").optional().trim(),
    body("description").optional().trim(),
  ]),
  asyncHandler(StudentPortalController.uploadSelfStudyPdf)
);

router.post(
  "/self-study/materials/upload/text",
  ...studentAuth,
  validate([
    body("organizationId").isMongoId(),
    body("title").trim().notEmpty(),
    body("content").trim().notEmpty(),
    body("description").optional().trim(),
  ]),
  asyncHandler(StudentPortalController.uploadSelfStudyText)
);

router.post(
  "/self-study/materials/upload/youtube",
  ...studentAuth,
  validate([
    body("organizationId").isMongoId(),
    body("title").trim().notEmpty(),
    body("youtubeUrl")
      .trim()
      .notEmpty()
      .matches(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/),
    body("description").optional().trim(),
  ]),
  asyncHandler(StudentPortalController.uploadSelfStudyYoutube)
);

router.get(
  "/self-study/lessons",
  ...studentAuth,
  validate([
    ...organizationIdQueryValidator,
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 50 }),
    query("search").optional().trim().isLength({ max: 200 }),
    query("generationStatus").optional().trim(),
  ]),
  asyncHandler(StudentPortalController.listPersonalLessons)
);

router.get(
  "/self-study/lessons/:id/status",
  ...studentAuth,
  validate([...organizationIdQueryValidator, ...lessonIdParamValidator]),
  asyncHandler(StudentPortalController.selfStudyStatus)
);

router.post(
  "/self-study/lessons/:id/regenerate",
  ...studentAuth,
  validate([
    ...organizationIdQueryValidator,
    ...lessonIdParamValidator,
    body("prompt").optional().trim().isLength({ min: 10, max: 8000 }),
  ]),
  asyncHandler(StudentPortalController.regeneratePersonalLesson)
);

router.post(
  "/self-study/lessons/:id/materials",
  ...studentAuth,
  validate([
    ...organizationIdQueryValidator,
    ...lessonIdParamValidator,
    body("materialIds").isArray({ min: 1 }),
    body("materialIds.*").isMongoId(),
    body("reprocess").optional().isBoolean(),
  ]),
  asyncHandler(StudentPortalController.addMaterialsToPersonalLesson)
);

router.post(
  "/self-study/lessons/:id/flashcards/generate",
  ...studentAuth,
  validate([
    ...organizationIdQueryValidator,
    ...lessonIdParamValidator,
    body("count").optional().isInt({ min: 3, max: 30 }),
    body("difficulty").optional().isIn(["easy", "medium", "hard"]),
    body("title").optional().trim().isLength({ max: 200 }),
  ]),
  asyncHandler(StudentPortalController.generateFlashcards)
);

router.post(
  "/self-study/lessons/:id/quizzes/generate",
  ...studentAuth,
  validate([
    ...organizationIdQueryValidator,
    ...lessonIdParamValidator,
    body("count").optional().isInt({ min: 3, max: 25 }),
    body("difficulty").optional().isIn(["easy", "medium", "hard"]),
    body("title").optional().trim().isLength({ max: 200 }),
  ]),
  asyncHandler(StudentPortalController.generateQuiz)
);

router.get(
  "/notes",
  ...studentAuth,
  validate([
    ...organizationIdQueryValidator,
    query("lessonId").optional().isMongoId(),
    query("quizId").optional().isMongoId(),
    query("flashcardId").optional().isMongoId(),
    query("scope").optional().isIn(["all", "general", "lesson"]),
  ]),
  asyncHandler(StudentPortalController.listNotes)
);

router.put(
  "/notes",
  ...studentAuth,
  validate([
    body("organizationId").isMongoId(),
    body("content").isString(),
    body("id").optional({ nullable: true }).isMongoId(),
    body("lessonId").optional({ nullable: true }).isMongoId(),
    body("quizId").optional().isMongoId(),
    body("flashcardId").optional().isMongoId(),
    body("title").optional().trim().isLength({ max: 120 }),
  ]),
  asyncHandler(StudentPortalController.saveNote)
);

router.delete(
  "/notes/:id",
  ...studentAuth,
  asyncHandler(StudentPortalController.deleteNote)
);

router.get(
  "/milestones",
  ...studentAuth,
  validate(organizationIdQueryValidator),
  asyncHandler(StudentPortalController.milestones)
);

router.post(
  "/chat",
  ...studentAuth,
  validate([
    body("organizationId").isMongoId(),
    body("message").trim().notEmpty(),
    body("sessionId").optional({ nullable: true }).isMongoId(),
    body("lessonId").optional({ nullable: true }).isMongoId(),
    body("topicId").optional({ nullable: true }).isMongoId(),
    body("materialId").optional({ nullable: true }).isMongoId(),
    body("quizId").optional({ nullable: true }).isMongoId(),
    body("flashcardId").optional({ nullable: true }).isMongoId(),
  ]),
  asyncHandler(StudentPortalController.chat)
);

router.get(
  "/chat/history",
  ...studentAuth,
  validate(organizationIdQueryValidator),
  asyncHandler(StudentPortalController.chatHistory)
);

router.get(
  "/chat/sessions",
  ...studentAuth,
  validate(organizationIdQueryValidator),
  asyncHandler(StudentPortalController.chatHistory)
);

router.get(
  "/chat/sessions/:id",
  ...studentAuth,
  validate(sessionIdParamValidator),
  asyncHandler(StudentPortalController.chatSession)
);

router.patch(
  "/chat/sessions/:id",
  ...studentAuth,
  validate([
    ...sessionIdParamValidator,
    body("title").trim().notEmpty().isLength({ max: 120 }),
  ]),
  asyncHandler(StudentPortalController.renameChatSession)
);

router.delete(
  "/chat/sessions/:id",
  ...studentAuth,
  validate(sessionIdParamValidator),
  asyncHandler(StudentPortalController.deleteChatSession)
);

router.get(
  "/recommendations",
  ...studentAuth,
  validate(organizationIdQueryValidator),
  asyncHandler(StudentPortalController.recommendations)
);

router.get(
  "/learning-path",
  ...studentAuth,
  validate(organizationIdQueryValidator),
  asyncHandler(StudentPortalController.learningPath)
);

router.get(
  "/revision-plan",
  ...studentAuth,
  validate(organizationIdQueryValidator),
  asyncHandler(StudentPortalController.revisionPlan)
);

router.get(
  "/history",
  ...studentAuth,
  validate(organizationIdQueryValidator),
  asyncHandler(StudentPortalController.history)
);

router.get(
  "/achievements",
  ...studentAuth,
  validate(organizationIdQueryValidator),
  asyncHandler(StudentPortalController.achievements)
);

router.post(
  "/workspace/provision",
  ...studentAuth,
  asyncHandler(StudentPortalController.provisionWorkspace)
);

router.get(
  "/subscription",
  ...studentAuth,
  validate(organizationIdQueryValidator),
  asyncHandler(StudentPortalController.subscription)
);

router.get(
  "/practice",
  ...studentAuth,
  validate(organizationIdQueryValidator),
  asyncHandler(StudentPortalController.practice)
);

router.get(
  "/study-queue",
  ...studentAuth,
  validate(organizationIdQueryValidator),
  asyncHandler(StudentPortalController.studyQueue)
);

router.get(
  "/leaderboard",
  ...studentAuth,
  validate(organizationIdQueryValidator),
  asyncHandler(StudentPortalController.leaderboard)
);

export default router;
