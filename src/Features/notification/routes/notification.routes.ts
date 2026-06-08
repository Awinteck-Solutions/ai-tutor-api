import { Router } from "express";
import { authenticate } from "../../../middlewares/authentication.middleware";
import { asyncHandler } from "../../../shared/utils/asyncHandler";
import { NotificationController } from "../controllers/notification.controller";

const router = Router();

router.get("/", authenticate, asyncHandler(NotificationController.list));
router.patch("/:id/read", authenticate, asyncHandler(NotificationController.markRead));
router.patch("/read-all", authenticate, asyncHandler(NotificationController.markAllRead));

export default router;
