import { Request, Response } from "express";
import { InvoiceStatus } from "../../../shared/enums/invoiceStatus.enum";
import { Role } from "../../../shared/enums/roles.enum";
import { Status } from "../../../shared/enums/status.enum";
import { SubscriptionPlan } from "../../../shared/enums/subscriptionPlan.enum";
import { ApiResponse } from "../../../shared/utils/apiResponse";
import { PlatformAdminService } from "../services/platformAdmin.service";
import { PlatformInvoiceService } from "../services/platformInvoice.service";
import { VisitTrackingService } from "../services/visitTracking.service";
import { HealthMonitorService } from "../services/healthMonitor.service";

export class PlatformController {
  static async getStats(req: Request, res: Response): Promise<Response> {
    const days = req.query.days ? Number(req.query.days) : 30;
    const stats = await PlatformAdminService.getStats(days);
    return ApiResponse.success(res, stats, "Platform stats");
  }

  static async recordVisit(req: Request, res: Response): Promise<Response> {
    await VisitTrackingService.record({
      path: req.body.path,
      referrer: req.body.referrer,
      portal: req.body.portal,
      userId: req.currentUser?.sub,
      organizationId: req.currentUser?.organizationId,
      req,
    });
    return ApiResponse.success(res, { recorded: true }, "Visit recorded");
  }

  static async listVisits(req: Request, res: Response): Promise<Response> {
    const data = await VisitTrackingService.list({
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      country: req.query.country as string | undefined,
      portal: req.query.portal as string | undefined,
      days: req.query.days ? Number(req.query.days) : undefined,
    });
    return ApiResponse.success(res, data, "Visits");
  }

  static async getTraffic(req: Request, res: Response): Promise<Response> {
    const days = req.query.days ? Number(req.query.days) : 30;
    const data = await VisitTrackingService.geographySummary(days);
    return ApiResponse.success(res, data, "Traffic summary");
  }

  static async getHealth(req: Request, res: Response): Promise<Response> {
    const hours = req.query.hours ? Number(req.query.hours) : 24;
    const data = await HealthMonitorService.getOverview(hours);
    return ApiResponse.success(res, data, "Health overview");
  }

  static async runHealthCheck(_req: Request, res: Response): Promise<Response> {
    await HealthMonitorService.runChecks();
    const data = await HealthMonitorService.getOverview(24);
    return ApiResponse.success(res, data, "Health check completed");
  }

  static async listUsers(req: Request, res: Response): Promise<Response> {
    const data = await PlatformAdminService.listUsers({
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      search: req.query.search as string | undefined,
      role: req.query.role as Role | undefined,
      status: req.query.status as Status | undefined,
    });
    return ApiResponse.success(res, data, "Users");
  }

  static async updateUser(req: Request, res: Response): Promise<Response> {
    const data = await PlatformAdminService.updateUser(
      req.params.id,
      req.body,
      req.currentUser!.sub,
      req
    );
    return ApiResponse.success(res, data, "User updated");
  }

  static async listOrganizations(req: Request, res: Response): Promise<Response> {
    const data = await PlatformAdminService.listOrganizations({
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      search: req.query.search as string | undefined,
      plan: req.query.plan as SubscriptionPlan | undefined,
    });
    return ApiResponse.success(res, data, "Organizations");
  }

  static async upgradePlan(req: Request, res: Response): Promise<Response> {
    const data = await PlatformInvoiceService.upgradeOrganizationPlan(
      req.params.organizationId,
      req.body.plan,
      req.currentUser!.sub,
      req
    );
    return ApiResponse.success(res, data, "Plan upgraded");
  }

  static async listInvoices(req: Request, res: Response): Promise<Response> {
    const data = await PlatformInvoiceService.list({
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      status: req.query.status as InvoiceStatus | undefined,
      organizationId: req.query.organizationId as string | undefined,
    });
    return ApiResponse.success(res, data, "Invoices");
  }

  static async createInvoice(req: Request, res: Response): Promise<Response> {
    const data = await PlatformInvoiceService.create(
      req.body,
      req.currentUser!.sub,
      req
    );
    return ApiResponse.created(res, data, "Invoice created");
  }

  static async updateInvoice(req: Request, res: Response): Promise<Response> {
    const data = await PlatformInvoiceService.updateStatus(
      req.params.id,
      req.body.status,
      req.currentUser!.sub,
      req
    );
    return ApiResponse.success(res, data, "Invoice updated");
  }
}
