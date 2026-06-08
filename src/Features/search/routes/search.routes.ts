import { Router } from "express";
import { authenticate } from "../../../middlewares/authentication.middleware";
import { asyncHandler } from "../../../shared/utils/asyncHandler";
import { AccessControlService } from "../../../shared/services/accessControl.service";
import { SearchController } from "../controllers/search.controller";

const router = Router();

router.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const orgId = req.query.organizationId as string;
    if (orgId) {
      await AccessControlService.assertOrgRead(req.currentUser!, orgId);
    }
    return SearchController.search(req, res);
  })
);

export default router;
