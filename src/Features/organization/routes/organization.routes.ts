import { Router } from "express";
import { authenticate } from "../../../middlewares/authentication.middleware";
import { authorize } from "../../../middlewares/authorization.middleware";
import { validate } from "../../../middlewares/validation.middleware";
import { Role } from "../../../shared/enums/roles.enum";
import { asyncHandler } from "../../../shared/utils/asyncHandler";
import { OrganizationController } from "../controllers/organization.controller";
import { OrganizationMemberController } from "../controllers/organizationMember.controller";
import {
  addMemberValidator,
  createOrganizationValidator,
  createMemberDirectValidator,
  organizationIdValidator,
  removeMemberValidator,
  suspendMemberValidator,
  updateOrganizationValidator,
} from "../validators/organization.validator";

const router = Router();

/**
 * @swagger
 * /organizations:
 *   post:
 *     summary: Create a new organization
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: "Springfield High School" }
 *               logo: { type: string, format: uri }
 *               subscriptionPlan:
 *                 type: string
 *                 enum: [FREE, BASIC, PRO, ENTERPRISE]
 *     responses:
 *       201:
 *         description: Organization created
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Organization'
 */
router.post(
  "/",
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.TEACHER, Role.PARENT),
  validate(createOrganizationValidator),
  asyncHandler(OrganizationController.create)
);

/**
 * @swagger
 * /organizations:
 *   get:
 *     summary: List organizations
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Organizations retrieved
 */
router.get(
  "/",
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN),
  asyncHandler(OrganizationController.list)
);

/**
 * @swagger
 * /organizations/{id}:
 *   get:
 *     summary: Get organization by ID
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Organization retrieved
 *       404:
 *         description: Organization not found
 */
router.get(
  "/:id",
  authenticate,
  validate(organizationIdValidator),
  asyncHandler(OrganizationController.getById)
);

/**
 * @swagger
 * /organizations/{id}:
 *   patch:
 *     summary: Update organization
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               logo: { type: string, format: uri }
 *               subscriptionPlan:
 *                 type: string
 *                 enum: [FREE, BASIC, PRO, ENTERPRISE]
 *     responses:
 *       200:
 *         description: Organization updated
 */
router.patch(
  "/:id",
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN),
  validate(updateOrganizationValidator),
  asyncHandler(OrganizationController.update)
);

/**
 * @swagger
 * /organizations/{id}/members:
 *   post:
 *     summary: Add member to organization
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, role]
 *             properties:
 *               userId: { type: string }
 *               role:
 *                 type: string
 *                 enum: [TEACHER, STUDENT, PARENT]
 *     responses:
 *       200:
 *         description: Member added
 */
router.post(
  "/:id/members",
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN),
  validate(addMemberValidator),
  asyncHandler(OrganizationController.addMember)
);

/**
 * @swagger
 * /organizations/{id}/members/{userId}:
 *   delete:
 *     summary: Remove member from organization
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Member removed
 */
router.delete(
  "/:id/members/:userId",
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN),
  validate(removeMemberValidator),
  asyncHandler(OrganizationController.removeMember)
);

router.get(
  "/:id/members",
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.TEACHER),
  validate(organizationIdValidator),
  asyncHandler(OrganizationMemberController.listMembers)
);

router.get(
  "/:id/invites",
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN),
  validate(organizationIdValidator),
  asyncHandler(OrganizationMemberController.listInvites)
);

router.post(
  "/:id/members/create",
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN),
  validate(createMemberDirectValidator),
  asyncHandler(OrganizationMemberController.createMemberDirect)
);

router.get(
  "/:id/assignments",
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN),
  validate(organizationIdValidator),
  asyncHandler(OrganizationMemberController.listAssignments)
);

router.post(
  "/:id/invites",
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN),
  validate(organizationIdValidator),
  asyncHandler(OrganizationMemberController.invite)
);

router.get(
  "/invites/preview",
  asyncHandler(OrganizationMemberController.previewInvite)
);

router.post(
  "/invites/accept",
  asyncHandler(OrganizationMemberController.acceptInvite)
);

router.patch(
  "/:id/members/:userId/suspend",
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN),
  validate(suspendMemberValidator),
  asyncHandler(OrganizationMemberController.suspend)
);

router.post(
  "/:id/parent-links",
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN),
  validate(organizationIdValidator),
  asyncHandler(OrganizationMemberController.linkParent)
);

router.post(
  "/:id/assignments/teacher",
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN),
  validate(organizationIdValidator),
  asyncHandler(OrganizationMemberController.assignTeacher)
);

router.post(
  "/:id/assignments/student",
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN),
  validate(organizationIdValidator),
  asyncHandler(OrganizationMemberController.enrollStudent)
);

/**
 * @swagger
 * /organizations/{id}:
 *   delete:
 *     summary: Soft delete organization
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Organization deleted
 */
router.delete(
  "/:id",
  authenticate,
  authorize(Role.SUPER_ADMIN),
  validate(organizationIdValidator),
  asyncHandler(OrganizationController.delete)
);

export default router;
