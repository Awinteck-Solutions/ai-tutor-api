import { Router } from "express";
import { authenticate } from "../../../middlewares/authentication.middleware";
import { authorize } from "../../../middlewares/authorization.middleware";
import { validate } from "../../../middlewares/validation.middleware";
import { asyncHandler } from "../../../shared/utils/asyncHandler";
import { Role } from "../../../shared/enums/roles.enum";
import { organizationIdQueryValidator, studentIdParamValidator } from "../shared/portal.validator";
import { TeacherPortalController } from "./teacherPortal.controller";

const router = Router();

const teacherAuth = [
  authenticate,
  authorize(Role.TEACHER, Role.SCHOOL_ADMIN, Role.SUPER_ADMIN),
];

router.get(
  "/dashboard",
  ...teacherAuth,
  validate(organizationIdQueryValidator),
  asyncHandler(TeacherPortalController.dashboard)
);

router.get(
  "/subjects",
  ...teacherAuth,
  validate(organizationIdQueryValidator),
  asyncHandler(TeacherPortalController.subjects)
);

router.get(
  "/topics",
  ...teacherAuth,
  validate(organizationIdQueryValidator),
  asyncHandler(TeacherPortalController.topics)
);

router.get(
  "/lessons",
  ...teacherAuth,
  validate(organizationIdQueryValidator),
  asyncHandler(TeacherPortalController.lessons)
);

router.get(
  "/materials",
  ...teacherAuth,
  validate(organizationIdQueryValidator),
  asyncHandler(TeacherPortalController.materials)
);

router.get(
  "/students",
  ...teacherAuth,
  validate(organizationIdQueryValidator),
  asyncHandler(TeacherPortalController.students)
);

router.get(
  "/students/:id",
  ...teacherAuth,
  validate(studentIdParamValidator),
  asyncHandler(TeacherPortalController.studentById)
);

export default router;
