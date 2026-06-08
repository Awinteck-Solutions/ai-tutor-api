import { Router } from "express";
import { authenticate } from "../../../middlewares/authentication.middleware";
import { authorize } from "../../../middlewares/authorization.middleware";
import { validate } from "../../../middlewares/validation.middleware";
import { asyncHandler } from "../../../shared/utils/asyncHandler";
import { Role } from "../../../shared/enums/roles.enum";
import { organizationIdQueryValidator } from "../shared/portal.validator";
import { OrgPortalController } from "./orgPortal.controller";

const router = Router();

const adminAuth = [
  authenticate,
  authorize(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN),
];

router.get(
  "/dashboard",
  ...adminAuth,
  validate(organizationIdQueryValidator),
  asyncHandler(OrgPortalController.dashboard)
);

router.get(
  "/usage",
  ...adminAuth,
  validate(organizationIdQueryValidator),
  asyncHandler(OrgPortalController.usage)
);

router.get(
  "/subscription",
  ...adminAuth,
  validate(organizationIdQueryValidator),
  asyncHandler(OrgPortalController.subscription)
);

export default router;
