import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import type { Request } from "express";
import { env } from "../config/env";

function shouldSkipRateLimit(req?: Request): boolean {
  if (process.env.RATE_LIMIT_ENABLED === "false") return true;
  if (env.nodeEnv !== "production") return true;
  if (req?.path === "/health" || req?.path.startsWith("/health/")) return true;
  return false;
}

export const securityMiddleware = [
  helmet(),
  cors({
    origin: env.nodeEnv === "production" ? env.apiBaseUrl : true,
    credentials: true,
  }),
];

export const apiRateLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => shouldSkipRateLimit(req),
  message: {
    success: false,
    message: "Too many requests, please try again later",
  },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.nodeEnv === "production" ? 20 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => shouldSkipRateLimit(),
  message: {
    success: false,
    message: "Too many authentication attempts, please try again later",
  },
});
