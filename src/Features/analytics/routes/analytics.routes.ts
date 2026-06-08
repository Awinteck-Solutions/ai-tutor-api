import { Router } from "express";
import { authenticate } from "../../../middlewares/authentication.middleware";
import { asyncHandler } from "../../../shared/utils/asyncHandler";
import { AnalyticsController } from "../controllers/analytics.controller";

const router = Router();

router.get("/student", authenticate, asyncHandler(AnalyticsController.student));
router.get("/teacher", authenticate, asyncHandler(AnalyticsController.teacher));
router.get("/organization/:organizationId", authenticate, asyncHandler(AnalyticsController.organization));
router.get("/flashcards/retention", authenticate, asyncHandler(AnalyticsController.flashcardRetention));

export default router;
