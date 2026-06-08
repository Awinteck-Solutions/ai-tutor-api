import { body, param } from "express-validator";
import { SubscriptionPlan } from "../../../shared/enums/subscriptionPlan.enum";
import { Role } from "../../../shared/enums/roles.enum";

export const createOrganizationValidator = [
  body("name").trim().notEmpty().withMessage("Organization name is required"),
  body("logo").optional().isURL().withMessage("Logo must be a valid URL"),
  body("subscriptionPlan")
    .optional()
    .isIn(Object.values(SubscriptionPlan))
    .withMessage("Invalid subscription plan"),
];

export const updateOrganizationValidator = [
  param("id").isMongoId().withMessage("Invalid organization ID"),
  body("name").optional().trim().notEmpty(),
  body("logo").optional().isURL(),
  body("subscriptionPlan")
    .optional()
    .isIn(Object.values(SubscriptionPlan)),
];

export const organizationIdValidator = [
  param("id").isMongoId().withMessage("Invalid organization ID"),
];

export const addMemberValidator = [
  param("id").isMongoId().withMessage("Invalid organization ID"),
  body("userId").isMongoId().withMessage("Valid user ID is required"),
  body("role")
    .isIn([Role.TEACHER, Role.STUDENT, Role.PARENT])
    .withMessage("Role must be TEACHER, STUDENT, or PARENT"),
];

export const removeMemberValidator = [
  param("id").isMongoId().withMessage("Invalid organization ID"),
  param("userId").isMongoId().withMessage("Invalid user ID"),
];

export const createMemberDirectValidator = [
  param("id").isMongoId().withMessage("Invalid organization ID"),
  body("firstName").trim().notEmpty().withMessage("First name is required"),
  body("lastName").trim().notEmpty().withMessage("Last name is required"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
  body("role")
    .isIn([Role.TEACHER, Role.STUDENT, Role.PARENT, Role.SCHOOL_ADMIN])
    .withMessage("Invalid role"),
];

export const suspendMemberValidator = [
  param("id").isMongoId().withMessage("Invalid organization ID"),
  param("userId").isMongoId().withMessage("Invalid user ID"),
  body("suspend").optional().isBoolean(),
];
