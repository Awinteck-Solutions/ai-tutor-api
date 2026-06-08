import { Router } from "express";
import { authenticate } from "../../../middlewares/authentication.middleware";
import { validate } from "../../../middlewares/validation.middleware";
import { asyncHandler } from "../../../shared/utils/asyncHandler";
import { ChatController } from "../controllers/chat.controller";
import {
  createSessionValidator,
  listSessionsValidator,
  sendMessageValidator,
  sessionIdValidator,
} from "../validators/chat.validator";

const router = Router();

router.post(
  "/sessions",
  authenticate,
  validate(createSessionValidator),
  asyncHandler(ChatController.createSession)
);

router.get(
  "/sessions",
  authenticate,
  validate(listSessionsValidator),
  asyncHandler(ChatController.listSessions)
);

router.get(
  "/sessions/:sessionId",
  authenticate,
  validate(sessionIdValidator),
  asyncHandler(ChatController.getSession)
);

router.post(
  "/sessions/:sessionId/messages",
  authenticate,
  validate(sendMessageValidator),
  asyncHandler(ChatController.sendMessage)
);

router.delete(
  "/sessions/:sessionId",
  authenticate,
  validate(sessionIdValidator),
  asyncHandler(ChatController.deleteSession)
);

export default router;
