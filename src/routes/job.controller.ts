import { Request, Response } from "express";
import { ApiResponse } from "../shared/utils/apiResponse";
import { listFailedJobs, listQueueJobs } from "../services/queue/job.queue";
import { MATERIAL_QUEUE, AI_GENERATION_QUEUE } from "../services/qdrant/qdrant.constants";
import { JobAccessService } from "../shared/services/jobAccess.service";

export class JobController {
  static async getStatus(req: Request, res: Response): Promise<Response> {
    const status = await JobAccessService.getJobForUser(
      req.currentUser!,
      req.query.queue as string,
      req.params.jobId
    );
    return ApiResponse.success(res, status);
  }

  static async list(req: Request, res: Response): Promise<Response> {
    const queueName = (req.query.queue as string) || MATERIAL_QUEUE;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const status = (req.query.status as string) || "all";
    const jobs = await listQueueJobs(queueName, {
      limit,
      status: status as "all" | "completed" | "failed" | "active" | "waiting" | "delayed",
    });
    return ApiResponse.success(res, { queue: queueName, status, jobs });
  }

  static async listFailed(req: Request, res: Response): Promise<Response> {
    const queueName = (req.query.queue as string) || MATERIAL_QUEUE;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const jobs = await listFailedJobs(queueName, limit);
    return ApiResponse.success(res, { queue: queueName, jobs });
  }

  static async listQueues(_req: Request, res: Response): Promise<Response> {
    return ApiResponse.success(res, {
      queues: [MATERIAL_QUEUE, AI_GENERATION_QUEUE],
    });
  }
}
