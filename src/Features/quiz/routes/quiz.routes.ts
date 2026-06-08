import { Router } from "express";
import { authenticate } from "../../../middlewares/authentication.middleware";
import { validate } from "../../../middlewares/validation.middleware";
import { asyncHandler } from "../../../shared/utils/asyncHandler";
import { QuizController } from "../controllers/quiz.controller";
import { quizIdValidator } from "../../lesson/validators/lesson.validator";

const router = Router();

router.get(
  "/:id",
  authenticate,
  validate(quizIdValidator),
  asyncHandler(QuizController.getById)
);

export default router;
