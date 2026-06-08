import { Router } from "express";
import { authenticate } from "../../../middlewares/authentication.middleware";
import { asyncHandler } from "../../../shared/utils/asyncHandler";
import { AcademicController } from "../controllers/academic.controller";

const router = Router({ mergeParams: true });

router.post("/years", authenticate, asyncHandler(AcademicController.createYear));
router.get("/years", authenticate, asyncHandler(AcademicController.listYears));
router.post("/terms", authenticate, asyncHandler(AcademicController.createTerm));
router.get("/years/:yearId/terms", authenticate, asyncHandler(AcademicController.listTerms));
router.post("/subjects", authenticate, asyncHandler(AcademicController.createSubject));
router.get("/subjects", authenticate, asyncHandler(AcademicController.listSubjects));
router.get(
  "/subjects/:subjectId/enrollments",
  authenticate,
  asyncHandler(AcademicController.listSubjectEnrollments)
);
router.post("/topics", authenticate, asyncHandler(AcademicController.createTopic));
router.get("/subjects/:subjectId/topics", authenticate, asyncHandler(AcademicController.listTopics));
router.patch("/subjects/:subjectId/topics/reorder", authenticate, asyncHandler(AcademicController.reorderTopics));

export default router;
