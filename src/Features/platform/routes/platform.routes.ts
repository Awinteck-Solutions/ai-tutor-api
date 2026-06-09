import { Router } from "express";
import { authenticate, optionalAuthenticate } from "../../../middlewares/authentication.middleware";
import { authorize } from "../../../middlewares/authorization.middleware";
import { validate } from "../../../middlewares/validation.middleware";
import { asyncHandler } from "../../../shared/utils/asyncHandler";
import { Role } from "../../../shared/enums/roles.enum";
import { PlatformController } from "../controllers/platform.controller";
import {
  createInvoiceValidator,
  listOrganizationsValidator,
  listUsersValidator,
  listVisitsValidator,
  recordVisitValidator,
  updateInvoiceValidator,
  updateUserValidator,
  upgradePlanValidator,
} from "../validators/platform.validator";

const router = Router();

router.post(
  "/visits",
  optionalAuthenticate,
  validate(recordVisitValidator),
  asyncHandler(PlatformController.recordVisit)
);

router.use(authenticate, authorize(Role.SUPER_ADMIN));

router.get("/stats", asyncHandler(PlatformController.getStats));
router.get(
  "/visits",
  validate(listVisitsValidator),
  asyncHandler(PlatformController.listVisits)
);
router.get("/traffic", asyncHandler(PlatformController.getTraffic));
router.get("/health", asyncHandler(PlatformController.getHealth));
router.post("/health/check", asyncHandler(PlatformController.runHealthCheck));

router.get(
  "/users",
  validate(listUsersValidator),
  asyncHandler(PlatformController.listUsers)
);
router.patch(
  "/users/:id",
  validate(updateUserValidator),
  asyncHandler(PlatformController.updateUser)
);

router.get(
  "/organizations",
  validate(listOrganizationsValidator),
  asyncHandler(PlatformController.listOrganizations)
);
router.patch(
  "/organizations/:organizationId/plan",
  validate(upgradePlanValidator),
  asyncHandler(PlatformController.upgradePlan)
);

router.get("/invoices", asyncHandler(PlatformController.listInvoices));
router.post(
  "/invoices",
  validate(createInvoiceValidator),
  asyncHandler(PlatformController.createInvoice)
);
router.patch(
  "/invoices/:id",
  validate(updateInvoiceValidator),
  asyncHandler(PlatformController.updateInvoice)
);

export default router;
