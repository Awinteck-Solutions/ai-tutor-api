import { Request } from "express";
import SiteVisit from "../models/siteVisit.model";
import {
  buildPaginationMeta,
  parsePagination,
} from "../../../shared/utils/pagination";

export interface RecordVisitInput {
  path: string;
  referrer?: string;
  portal?: string;
  userId?: string;
  organizationId?: string;
  req?: Request;
}

function resolveClientIp(req?: Request): string | undefined {
  if (!req) return undefined;
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0]?.trim();
  }
  return req.ip;
}

function resolveCountry(req?: Request): string | undefined {
  if (!req) return undefined;
  const cfCountry = req.headers["cf-ipcountry"];
  if (typeof cfCountry === "string" && cfCountry !== "XX") {
    return cfCountry.toUpperCase();
  }
  const geoCountry = req.headers["x-vercel-ip-country"];
  if (typeof geoCountry === "string") {
    return geoCountry.toUpperCase();
  }
  return undefined;
}

export class VisitTrackingService {
  static async record(input: RecordVisitInput): Promise<void> {
    const country = resolveCountry(input.req);
    await SiteVisit.create({
      path: input.path.slice(0, 500),
      referrer: input.referrer?.slice(0, 500),
      portal: input.portal,
      userId: input.userId,
      organizationId: input.organizationId,
      ipAddress: resolveClientIp(input.req),
      country: country ?? "Unknown",
      region:
        typeof input.req?.headers["x-vercel-ip-country-region"] === "string"
          ? input.req.headers["x-vercel-ip-country-region"]
          : undefined,
      city:
        typeof input.req?.headers["x-vercel-ip-city"] === "string"
          ? input.req.headers["x-vercel-ip-city"]
          : undefined,
      userAgent: input.req?.headers["user-agent"]?.slice(0, 500),
    });
  }

  static async list(query: {
    page?: number;
    limit?: number;
    country?: string;
    portal?: string;
    days?: number;
  }) {
    const { page, limit, skip } = parsePagination(query);
    const since = new Date();
    since.setDate(since.getDate() - (query.days ?? 30));

    const filter: Record<string, unknown> = { createdAt: { $gte: since } };
    if (query.country) filter.country = query.country.toUpperCase();
    if (query.portal) filter.portal = query.portal;

    const [items, total] = await Promise.all([
      SiteVisit.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      SiteVisit.countDocuments(filter),
    ]);

    return {
      items: items.map((v) => ({
        id: v._id.toString(),
        path: v.path,
        referrer: v.referrer,
        ipAddress: v.ipAddress,
        country: v.country,
        region: v.region,
        city: v.city,
        portal: v.portal,
        userId: v.userId?.toString(),
        organizationId: v.organizationId?.toString(),
        createdAt: v.createdAt,
      })),
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  static async geographySummary(days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const byCountry = await SiteVisit.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: "$country", visits: { $sum: 1 } } },
      { $sort: { visits: -1 } },
      { $limit: 50 },
    ]);

    const byPortal = await SiteVisit.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: "$portal", visits: { $sum: 1 } } },
      { $sort: { visits: -1 } },
    ]);

    const byDay = await SiteVisit.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          visits: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const topPaths = await SiteVisit.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: "$path", visits: { $sum: 1 } } },
      { $sort: { visits: -1 } },
      { $limit: 15 },
    ]);

    const uniqueIps = await SiteVisit.distinct("ipAddress", {
      createdAt: { $gte: since },
      ipAddress: { $exists: true, $ne: null },
    });

    return {
      totalVisits: byCountry.reduce((sum, row) => sum + row.visits, 0),
      uniqueVisitors: uniqueIps.length,
      byCountry: byCountry.map((row) => ({
        country: row._id ?? "Unknown",
        visits: row.visits,
      })),
      byPortal: byPortal.map((row) => ({
        portal: row._id ?? "unknown",
        visits: row.visits,
      })),
      byDay: byDay.map((row) => ({ date: row._id, visits: row.visits })),
      topPaths: topPaths.map((row) => ({ path: row._id, visits: row.visits })),
    };
  }
}
