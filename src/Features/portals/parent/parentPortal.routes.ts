import { Router } from "express";
import { authenticate } from "../../../middlewares/authentication.middleware";
import { authorize } from "../../../middlewares/authorization.middleware";
import { validate } from "../../../middlewares/validation.middleware";
import { asyncHandler } from "../../../shared/utils/asyncHandler";
import { Role } from "../../../shared/enums/roles.enum";
import { organizationIdQueryValidator, studentIdParamValidator } from "../shared/portal.validator";
import { ParentPortalController } from "./parentPortal.controller";

const router = Router();

const parentAuth = [
  authenticate,
  authorize(Role.PARENT, Role.SUPER_ADMIN),
];

router.get(
  "/dashboard",
  ...parentAuth,
  validate(organizationIdQueryValidator),
  asyncHandler(ParentPortalController.dashboard)
);

router.get(
  "/students/:id/progress",
  ...parentAuth,
  validate(studentIdParamValidator),
  asyncHandler(ParentPortalController.studentProgress)
);

router.get(
  "/students/:id/analytics",
  ...parentAuth,
  validate(studentIdParamValidator),
  asyncHandler(ParentPortalController.studentAnalytics)
);

router.get(
  "/students/:id/activity",
  ...parentAuth,
  validate(studentIdParamValidator),
  asyncHandler(ParentPortalController.studentActivity)
);

export default router;
