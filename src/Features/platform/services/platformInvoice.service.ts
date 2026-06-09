import { Request } from "express";
import { InvoiceStatus } from "../../../shared/enums/invoiceStatus.enum";
import { SubscriptionPlan } from "../../../shared/enums/subscriptionPlan.enum";
import { AppError } from "../../../shared/errors/AppError";
import { AuditService } from "../../../shared/services/audit.service";
import { ActivityType } from "../../../shared/enums/activityType.enum";
import Organization from "../../organization/models/organization.model";
import PlatformInvoice from "../models/platformInvoice.model";
import {
  buildPaginationMeta,
  parsePagination,
} from "../../../shared/utils/pagination";

const PLAN_PRICING_USD: Record<SubscriptionPlan, number> = {
  [SubscriptionPlan.FREE]: 0,
  [SubscriptionPlan.BASIC]: 29,
  [SubscriptionPlan.PRO]: 79,
  [SubscriptionPlan.ENTERPRISE]: 299,
};

function generateInvoiceNumber(): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.floor(Math.random() * 9000 + 1000);
  return `ADS-${stamp}-${suffix}`;
}

export class PlatformInvoiceService {
  static async list(query: {
    page?: number;
    limit?: number;
    status?: InvoiceStatus;
    organizationId?: string;
  }) {
    const { page, limit, skip } = parsePagination(query);
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.organizationId) filter.organizationId = query.organizationId;

    const [items, total] = await Promise.all([
      PlatformInvoice.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("organizationId", "name slug"),
      PlatformInvoice.countDocuments(filter),
    ]);

    return {
      items: items.map((inv) => this.toResponse(inv)),
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  static async create(
    input: {
      organizationId: string;
      userId?: string;
      plan: SubscriptionPlan;
      amount?: number;
      currency?: string;
      description?: string;
      notes?: string;
      dueDate?: string;
      status?: InvoiceStatus;
    },
    issuedBy: string,
    req?: Request
  ) {
    const org = await Organization.findById(input.organizationId);
    if (!org) throw new AppError("Organization not found", 404);

    const amount =
      input.amount ?? PLAN_PRICING_USD[input.plan] ?? PLAN_PRICING_USD.FREE;
    const invoice = await PlatformInvoice.create({
      invoiceNumber: generateInvoiceNumber(),
      organizationId: input.organizationId,
      userId: input.userId,
      plan: input.plan,
      amount,
      currency: input.currency ?? "USD",
      status: input.status ?? InvoiceStatus.DRAFT,
      description:
        input.description ??
        `Adesia ${input.plan} plan — ${org.name}`,
      notes: input.notes,
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      issuedBy,
    });

    await AuditService.log({
      activityType: ActivityType.ASSIGNMENT,
      description: `Platform invoice ${invoice.invoiceNumber} created for ${org.name}`,
      organizationId: input.organizationId,
      userId: issuedBy,
      resourceType: "PlatformInvoice",
      resourceId: invoice._id.toString(),
      metadata: { plan: input.plan, amount, status: invoice.status },
      req,
    });

    return this.toResponse(invoice);
  }

  static async updateStatus(
    id: string,
    status: InvoiceStatus,
    issuedBy: string,
    req?: Request
  ) {
    const invoice = await PlatformInvoice.findById(id);
    if (!invoice) throw new AppError("Invoice not found", 404);

    invoice.status = status;
    if (status === InvoiceStatus.PAID) {
      invoice.paidAt = new Date();
      const org = await Organization.findById(invoice.organizationId);
      if (org) {
        org.subscriptionPlan = invoice.plan;
        await org.save();
      }
    }
    await invoice.save();

    await AuditService.log({
      activityType: ActivityType.ASSIGNMENT,
      description: `Invoice ${invoice.invoiceNumber} marked ${status}`,
      organizationId: invoice.organizationId.toString(),
      userId: issuedBy,
      resourceType: "PlatformInvoice",
      resourceId: invoice._id.toString(),
      metadata: { status, plan: invoice.plan },
      req,
    });

    return this.toResponse(invoice);
  }

  static async upgradeOrganizationPlan(
    organizationId: string,
    plan: SubscriptionPlan,
    issuedBy: string,
    req?: Request
  ) {
    const org = await Organization.findById(organizationId);
    if (!org) throw new AppError("Organization not found", 404);

    const previousPlan = org.subscriptionPlan;
    org.subscriptionPlan = plan;
    await org.save();

    const invoice = await this.create(
      {
        organizationId,
        plan,
        description: `Plan upgrade: ${previousPlan} → ${plan}`,
        status: InvoiceStatus.SENT,
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      },
      issuedBy,
      req
    );

    await AuditService.log({
      activityType: ActivityType.ROLE_CHANGE,
      description: `Organization plan changed from ${previousPlan} to ${plan}`,
      organizationId,
      userId: issuedBy,
      resourceType: "Organization",
      resourceId: organizationId,
      metadata: { previousPlan, plan },
      req,
    });

    return {
      organization: {
        id: org._id.toString(),
        name: org.name,
        subscriptionPlan: org.subscriptionPlan,
      },
      invoice,
    };
  }

  private static toResponse(invoice: InstanceType<typeof PlatformInvoice>) {
    const orgRef = invoice.organizationId as
      | { _id?: { toString(): string }; name?: string; slug?: string }
      | string
      | undefined;
    const organizationId =
      typeof orgRef === "object" && orgRef?._id
        ? orgRef._id.toString()
        : String(orgRef ?? "");

    return {
      id: invoice._id.toString(),
      invoiceNumber: invoice.invoiceNumber,
      organizationId,
      organizationName:
        typeof orgRef === "object" && orgRef?.name ? orgRef.name : undefined,
      userId: invoice.userId?.toString(),
      plan: invoice.plan,
      amount: invoice.amount,
      currency: invoice.currency,
      status: invoice.status,
      description: invoice.description,
      notes: invoice.notes,
      dueDate: invoice.dueDate,
      paidAt: invoice.paidAt,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
    };
  }
}
