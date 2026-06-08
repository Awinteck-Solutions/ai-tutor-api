import { Router } from "express";
import { authenticate } from "../middlewares/authentication.middleware";
import { authorize } from "../middlewares/authorization.middleware";
import { Role } from "../shared/enums/roles.enum";
import { asyncHandler } from "../shared/utils/asyncHandler";
import { JobController } from "./job.controller";

const router = Router();

router.get(
  "/queues",
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN),
  asyncHandler(JobController.listQueues)
);

router.get(
  "/",
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN),
  asyncHandler(JobController.list)
);

router.get(
  "/failed",
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN),
  asyncHandler(JobController.listFailed)
);

router.get(
  "/:jobId",
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.TEACHER),
  asyncHandler(JobController.getStatus)
);

export default router;
