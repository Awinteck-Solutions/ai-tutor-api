import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../shared/utils/asyncHandler";
import { ApiResponse } from "../shared/utils/apiResponse";
import { env } from "../config/env";

export class HealthController {
  static async health(_req: Request, res: Response): Promise<Response> {
    return ApiResponse.success(res, {
      status: "ok",
      version: "1.0.0",
      environment: env.nodeEnv,
      uptime: process.uptime(),
    });
  }

  static async ready(_req: Request, res: Response): Promise<Response> {
    const dbReady = mongoose.connection.readyState === 1;
    if (!dbReady) {
      return res.status(503).json({
        success: false,
        message: "Service not ready",
        data: { database: "disconnected" },
      });
    }
    return ApiResponse.success(res, {
      database: "connected",
      workers: env.workers.enabled,
    });
  }
}

const router = Router();

router.get("/", asyncHandler(HealthController.health));
router.get("/ready", asyncHandler(HealthController.ready));

export default router;
