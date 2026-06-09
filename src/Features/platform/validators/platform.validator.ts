import { body, param, query } from "express-validator";
import { InvoiceStatus } from "../../../shared/enums/invoiceStatus.enum";
import { Role } from "../../../shared/enums/roles.enum";
import { Status } from "../../../shared/enums/status.enum";
import { SubscriptionPlan } from "../../../shared/enums/subscriptionPlan.enum";

export const recordVisitValidator = [
  body("path").trim().notEmpty().isLength({ max: 500 }),
  body("referrer").optional().trim().isLength({ max: 500 }),
  body("portal").optional().trim().isLength({ max: 50 }),
];

export const listVisitsValidator = [
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("country").optional().trim(),
  query("portal").optional().trim(),
  query("days").optional().isInt({ min: 1, max: 90 }),
];

export const upgradePlanValidator = [
  param("organizationId").isMongoId(),
  body("plan").isIn(Object.values(SubscriptionPlan)),
];

export const createInvoiceValidator = [
  body("organizationId").isMongoId(),
  body("userId").optional().isMongoId(),
  body("plan").isIn(Object.values(SubscriptionPlan)),
  body("amount").optional().isFloat({ min: 0 }),
  body("currency").optional().trim().isLength({ max: 8 }),
  body("description").optional().trim().isLength({ max: 500 }),
  body("notes").optional().trim().isLength({ max: 1000 }),
  body("dueDate").optional().isISO8601(),
  body("status").optional().isIn(Object.values(InvoiceStatus)),
];

export const updateInvoiceValidator = [
  param("id").isMongoId(),
  body("status").isIn(Object.values(InvoiceStatus)),
];

export const updateUserValidator = [
  param("id").isMongoId(),
  body("role").optional().isIn(Object.values(Role)),
  body("status").optional().isIn(Object.values(Status)),
];

export const listUsersValidator = [
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("search").optional().trim(),
  query("role").optional().isIn(Object.values(Role)),
  query("status").optional().isIn(Object.values(Status)),
];

export const listOrganizationsValidator = [
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("search").optional().trim(),
  query("plan").optional().isIn(Object.values(SubscriptionPlan)),
];
