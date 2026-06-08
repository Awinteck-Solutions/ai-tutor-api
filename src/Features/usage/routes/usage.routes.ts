import { Router } from "express";
import { authenticate } from "../../../middlewares/authentication.middleware";
import { authorize } from "../../../middlewares/authorization.middleware";
import { Role } from "../../../shared/enums/roles.enum";
import { asyncHandler } from "../../../shared/utils/asyncHandler";
import { UsageController } from "../controllers/usage.controller";

const router = Router();

router.get(
  "/:organizationId",
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN),
  asyncHandler(UsageController.summary)
);

export default router;
