import { AppError } from "../errors/AppError";
import { JwtPayload } from "../../types/express.d";
import { AccessControlService } from "./accessControl.service";
import {
  getJobStatus,
  JobType,
  ProcessMaterialJobData,
  GenerateFlashcardsJobData,
  GenerateQuizJobData,
} from "../../services/queue/job.queue";
import Material from "../../Features/material/models/material.model";
import Lesson from "../../Features/lesson/models/lesson.model";

export class JobAccessService {
  static async getJobForUser(
    user: JwtPayload,
    queueName: string,
    jobId: string
  ) {
    const status = await getJobStatus(queueName, jobId);
    if (!status) {
      throw new AppError("Job not found", 404);
    }

    const organizationId = await this.resolveJobOrganizationId(
      status.name,
      status.data as Record<string, unknown>
    );

    if (organizationId) {
      await AccessControlService.assertOrgRead(user, organizationId);
    }

    return status;
  }

  private static async resolveJobOrganizationId(
    jobName: string,
    data: Record<string, unknown>
  ): Promise<string | null> {
    if (jobName === JobType.PROCESS_MATERIAL && data.materialId) {
      const payload = data as unknown as ProcessMaterialJobData;
      if (payload.organizationId) return payload.organizationId;
      const material = await Material.findById(payload.materialId).select(
        "organizationId"
      );
      return material?.organizationId.toString() ?? null;
    }

    const lessonId =
      data.lessonId ??
      (jobName === JobType.GENERATE_QUIZ
        ? (data as unknown as GenerateQuizJobData).lessonId
        : jobName === JobType.GENERATE_FLASHCARDS
          ? (data as unknown as GenerateFlashcardsJobData).lessonId
          : undefined);

    if (
      [
        JobType.GENERATE_LESSON,
        JobType.GENERATE_FLASHCARDS,
        JobType.GENERATE_QUIZ,
      ].includes(jobName as JobType) &&
      lessonId
    ) {
      const lesson = await Lesson.findById(lessonId).select("organizationId");
      return lesson?.organizationId.toString() ?? null;
    }

    return (data.organizationId as string) ?? null;
  }
}
