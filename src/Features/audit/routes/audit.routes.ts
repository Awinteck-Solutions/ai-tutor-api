import { Router } from "express";
import { query } from "express-validator";
import { authenticate } from "../../../middlewares/authentication.middleware";
import { authorize } from "../../../middlewares/authorization.middleware";
import { validate } from "../../../middlewares/validation.middleware";
import { asyncHandler } from "../../../shared/utils/asyncHandler";
import { Role } from "../../../shared/enums/roles.enum";
import { AuditController } from "../controllers/audit.controller";

const router = Router();

router.get(
  "/",
  authenticate,
  authorize(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN),
  validate([
    query("organizationId").isMongoId(),
    query("activityType").optional().isString(),
    query("userId").optional().isMongoId(),
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("search").optional().isString().trim(),
  ]),
  asyncHandler(AuditController.list)
);

export default router;
