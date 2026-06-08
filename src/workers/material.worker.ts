import { Job } from "bullmq";
import { MaterialProcessingService } from "../Features/material/services/materialProcessing.service";
import {
  createWorker,
  JobType,
  ProcessMaterialJobData,
} from "../services/queue/job.queue";
import { MATERIAL_QUEUE } from "../services/qdrant/qdrant.constants";

export function startMaterialWorker(): void {
  createWorker<ProcessMaterialJobData>(
    MATERIAL_QUEUE,
    async (job: Job<ProcessMaterialJobData>) => {
      if (job.name === JobType.PROCESS_MATERIAL) {
        await MaterialProcessingService.process(job.data.materialId);
      }
    }
  );

  console.log(`[Worker] Material processing worker started on queue: ${MATERIAL_QUEUE}`);
}
